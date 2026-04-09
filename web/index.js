import express from "express";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
import serveStatic from "serve-static";
import { verifyWebhookHmac, shopifyGraphQL, PLANS, CREATE_SUBSCRIPTION } from "./shopify.js";
import { verifyRequest } from "./middleware/verify-request.js";
import { getMerchantPlan, canCreateAccount, parseSpendTiers, currentMonth, buildWelcomeEmail } from "./lib/accountHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

app.use(compression());
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", app: "corporate-accounts" }));

// ─── WEBHOOKS (GDPR) ──────────────────────────────────────────────────────────
app.post("/api/webhooks/:topic", async (req, res) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!hmac || !verifyWebhookHmac(req.body.toString(), hmac, process.env.SHOPIFY_API_SECRET)) {
    return res.status(401).send("Unauthorized");
  }
  const shop = req.headers["x-shopify-shop-domain"];
  try {
    const topic = req.params.topic;
    if (topic === "app-uninstalled" || topic === "shop-redact") {
      await prisma.corporateInvoice.deleteMany({ where: { shop } });
      await prisma.corporateApplication.deleteMany({ where: { shop } });
      await prisma.merchantPlan.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
    }
    if (topic === "customers-redact") {
      const body = JSON.parse(req.body.toString());
      const email = body?.customer?.email;
      if (email) {
        await prisma.corporateApplication.updateMany({
          where: { shop, email },
          data: { email: "redacted@gdpr.request", contactName: "Redacted", phone: "" },
        });
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("[webhook] error:", err);
    res.status(500).send("Error");
  }
});

// ─── PUBLIC ENDPOINT — Application form submission ────────────────────────────
// Accessed via the theme app extension as /apps/corporate-accounts/apply
app.post("/api/public/apply", async (req, res) => {
  const { shop, companyName, contactName, email, phone, position, estimatedMonthlySpend, deliveryAddress, billingAddress, notes, termsAccepted } = req.body;
  if (!shop || !companyName || !contactName || !email || !phone || !deliveryAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!termsAccepted) {
    return res.status(400).json({ error: "Terms must be accepted" });
  }
  try {
    const application = await prisma.corporateApplication.create({
      data: { shop, companyName, contactName, email, phone, position: position || "", estimatedMonthlySpend: estimatedMonthlySpend || "", deliveryAddress, billingAddress: billingAddress || "", notes: notes || "", termsAccepted: true },
    });
    res.json({ success: true, id: application.id });
  } catch (err) {
    console.error("[public/apply] error:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
app.get("/api/applications", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const page = parseInt(req.query.page || "1");
  const status = req.query.status;
  const where = { shop };
  if (status) where.status = status;
  try {
    const [applications, total] = await Promise.all([
      prisma.corporateApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
      prisma.corporateApplication.count({ where }),
    ]);
    res.json({ applications, total, page, pages: Math.ceil(total / 20) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.get("/api/applications/:id", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const application = await prisma.corporateApplication.findFirst({ where: { id: req.params.id, shop } });
    if (!application) return res.status(404).json({ error: "Not found" });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

app.post("/api/applications/:id/approve", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { customDiscount, customPricingNotes } = req.body;
  try {
    const merchant = await getMerchantPlan(shop);
    if (!(await canCreateAccount(shop, merchant.plan))) {
      return res.status(403).json({ error: "Free plan limit reached. Upgrade to approve more accounts.", upgrade: true });
    }
    const application = await prisma.corporateApplication.update({
      where: { id: req.params.id },
      data: { status: "approved", customDiscount: parseFloat(customDiscount) || 0, customPricingNotes: customPricingNotes || "" },
    });
    res.json(application);
  } catch (err) {
    console.error("[approve] error:", err);
    res.status(500).json({ error: "Failed to approve application" });
  }
});

app.post("/api/applications/:id/reject", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const application = await prisma.corporateApplication.update({ where: { id: req.params.id }, data: { status: "rejected" } });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: "Failed to reject application" });
  }
});

app.post("/api/applications/:id/suspend", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const application = await prisma.corporateApplication.update({ where: { id: req.params.id }, data: { status: "suspended" } });
    res.json(application);
  } catch (err) {
    res.status(500).json({ error: "Failed to suspend application" });
  }
});

// ─── INVOICES (per account) ───────────────────────────────────────────────────
app.get("/api/applications/:id/invoices", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const application = await prisma.corporateApplication.findFirst({ where: { id: req.params.id, shop } });
    if (!application) return res.status(404).json({ error: "Not found" });
    const invoices = await prisma.corporateInvoice.findMany({ where: { applicationId: req.params.id, shop }, orderBy: { createdAt: "desc" } });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

app.post("/api/applications/:id/invoices", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { month, orders, totalAmount } = req.body;
  try {
    const merchant = await getMerchantPlan(shop);
    if (merchant.plan !== "pro" && merchant.plan !== "enterprise") {
      return res.status(403).json({ error: "Invoice generation requires Pro plan or above.", upgrade: true });
    }
    const application = await prisma.corporateApplication.findFirst({ where: { id: req.params.id, shop } });
    if (!application) return res.status(404).json({ error: "Account not found" });
    const invoice = await prisma.corporateInvoice.create({
      data: { shop, applicationId: req.params.id, month: month || currentMonth(), orders: JSON.stringify(orders || []), totalAmount: parseFloat(totalAmount) || 0, status: "pending" },
    });
    res.json(invoice);
  } catch (err) {
    console.error("[invoices/create] error:", err);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

// ─── INVOICES (all) ───────────────────────────────────────────────────────────
app.get("/api/invoices", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const page = parseInt(req.query.page || "1");
  const status = req.query.status;
  const where = { shop };
  if (status) where.status = status;
  try {
    const [invoices, total] = await Promise.all([
      prisma.corporateInvoice.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20, include: { application: { select: { companyName: true, contactName: true } } } }),
      prisma.corporateInvoice.count({ where }),
    ]);
    res.json({ invoices, total, page, pages: Math.ceil(total / 20) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
app.get("/api/settings", verifyRequest, async (req, res) => {
  try {
    const merchant = await getMerchantPlan(req.shopSession.shop);
    res.json(merchant);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { termsAndConditions, bankName, bankAccountName, bankAccountNumber, bankSortCode, bankIban, welcomeEmailTemplate, spendTierOptions } = req.body;
  const data = {};
  if (termsAndConditions !== undefined) data.termsAndConditions = termsAndConditions;
  if (bankName !== undefined) data.bankName = bankName;
  if (bankAccountName !== undefined) data.bankAccountName = bankAccountName;
  if (bankAccountNumber !== undefined) data.bankAccountNumber = bankAccountNumber;
  if (bankSortCode !== undefined) data.bankSortCode = bankSortCode;
  if (bankIban !== undefined) data.bankIban = bankIban;
  if (welcomeEmailTemplate !== undefined) data.welcomeEmailTemplate = welcomeEmailTemplate;
  if (spendTierOptions !== undefined) data.spendTierOptions = typeof spendTierOptions === "string" ? spendTierOptions : JSON.stringify(spendTierOptions);
  try {
    const updated = await prisma.merchantPlan.upsert({ where: { shop }, create: { shop, ...data }, update: data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// ─── BILLING ──────────────────────────────────────────────────────────────────
app.get("/api/billing/status", verifyRequest, async (req, res) => {
  try {
    const merchant = await getMerchantPlan(req.shopSession.shop);
    const plan = merchant.plan || "free";
    const approvedCount = await prisma.corporateApplication.count({ where: { shop: req.shopSession.shop, status: "approved" } });
    const pendingCount = await prisma.corporateApplication.count({ where: { shop: req.shopSession.shop, status: "pending" } });
    res.json({ plan, price: PLANS[plan]?.price || 0, approvedCount, pendingCount, accountLimit: PLANS[plan]?.accountLimit === Infinity ? null : PLANS[plan]?.accountLimit });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch billing status" });
  }
});

app.post("/api/billing/subscribe", verifyRequest, async (req, res) => {
  const { shop, accessToken } = req.shopSession;
  const { plan } = req.body;
  if (!plan || !PLANS[plan] || plan === "free") return res.status(400).json({ error: "Invalid plan" });
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/api/billing/callback?shop=${shop}&plan=${plan}`;
  try {
    const result = await shopifyGraphQL(shop, accessToken, CREATE_SUBSCRIPTION, {
      name: `Corporate Accounts ${PLANS[plan].name}`,
      returnUrl,
      test: !IS_PROD,
      lineItems: [{ plan: { appRecurringPricingDetails: { price: { amount: PLANS[plan].price, currencyCode: "USD" }, interval: "EVERY_30_DAYS" } } }],
    });
    const { confirmationUrl, userErrors } = result.data.appSubscriptionCreate;
    if (userErrors.length > 0) return res.status(400).json({ error: "Failed", details: userErrors });
    res.json({ confirmationUrl });
  } catch (err) {
    res.status(500).json({ error: "Subscription failed" });
  }
});

app.get("/api/billing/callback", async (req, res) => {
  const { shop, plan, charge_id } = req.query;
  if (charge_id && plan && shop) {
    await prisma.merchantPlan.upsert({ where: { shop }, create: { shop, plan, subscriptionId: charge_id }, update: { plan, subscriptionId: charge_id } });
  }
  res.redirect(`/?shop=${shop}`);
});

// ─── STATIC FRONTEND ──────────────────────────────────────────────────────────
if (IS_PROD) {
  app.use(serveStatic(path.join(__dirname, "frontend", "dist")));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "frontend", "dist", "index.html")));
}

app.listen(PORT, () => console.log(`Corporate Accounts backend running on port ${PORT}`));
