import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Get the merchant's plan and settings, upserting defaults if not found.
 */
export async function getMerchantPlan(shop) {
  let merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  if (!merchant) {
    merchant = await prisma.merchantPlan.create({ data: { shop } });
  }
  return merchant;
}

/**
 * Check whether a shop on the free plan has hit the 3-account limit.
 */
export async function canCreateAccount(shop, plan) {
  if (plan !== "free") return true;
  const count = await prisma.corporateApplication.count({ where: { shop, status: "approved" } });
  return count < 3;
}

/**
 * Parse spend tier options from JSON string stored in DB.
 */
export function parseSpendTiers(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return ["Under $1,000", "$1,000 - $5,000", "$5,000 - $15,000", "$15,000 - $35,000", "$35,000+"];
  }
}

/**
 * Generate a simple month string YYYY-MM for the current month.
 */
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Build a plain-text welcome email body for a newly approved account.
 */
export function buildWelcomeEmail(template, application, merchant) {
  if (!template) {
    return `Dear ${application.contactName},\n\nCongratulations! Your corporate account application for ${application.companyName} has been approved.\n\nYou can now log in to place orders with your custom pricing.\n\nIf you have any questions, please don't hesitate to get in touch.\n\nKind regards,\nThe Team`;
  }
  return template
    .replace(/\{\{contactName\}\}/g, application.contactName)
    .replace(/\{\{companyName\}\}/g, application.companyName)
    .replace(/\{\{discount\}\}/g, application.customDiscount + "%");
}
