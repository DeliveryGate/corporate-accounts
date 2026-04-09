import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, TextField, Button, Badge, Toast, Frame,
  Text, BlockStack, InlineStack, Box, Divider,
} from "@shopify/polaris";

const PLANS = {
  free:       { name: "Free",       price: 0,  features: ["Application form only", "Up to 3 active accounts", "Basic dashboard"] },
  starter:    { name: "Starter",    price: 19, features: ["Unlimited accounts", "Admin review dashboard", "Custom pricing per account"] },
  pro:        { name: "Pro",        price: 39, features: ["Everything in Starter", "Monthly invoice generation", "Account portal with order history", "Custom T&Cs builder"] },
  enterprise: { name: "Enterprise", price: 99, features: ["Everything in Pro", "Multi-location accounts", "API access", "Custom onboarding", "Dedicated support"] },
};

export default function Settings() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [billing, setBilling] = useState(null);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [welcomeEmailTemplate, setWelcomeEmailTemplate] = useState("");
  const [spendTierOptions, setSpendTierOptions] = useState("");
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
      fetch(`/api/settings?shop=${shop}`).then(r => r.json()),
    ]).then(([b, s]) => {
      setBilling(b);
      setTermsAndConditions(s.termsAndConditions || "");
      setBankName(s.bankName || "");
      setBankAccountName(s.bankAccountName || "");
      setBankAccountNumber(s.bankAccountNumber || "");
      setBankSortCode(s.bankSortCode || "");
      setBankIban(s.bankIban || "");
      setWelcomeEmailTemplate(s.welcomeEmailTemplate || "");
      setSpendTierOptions(
        typeof s.spendTierOptions === "string"
          ? JSON.parse(s.spendTierOptions).join("\n")
          : (s.spendTierOptions || []).join("\n")
      );
    });
  }, [shop]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/settings?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        termsAndConditions,
        bankName,
        bankAccountName,
        bankAccountNumber,
        bankSortCode,
        bankIban,
        welcomeEmailTemplate,
        spendTierOptions: JSON.stringify(spendTierOptions.split("\n").map(s => s.trim()).filter(Boolean)),
      }),
    });
    setSaving(false);
    setToast("Settings saved");
  };

  const handleSubscribe = async (plan) => {
    setSubscribing(plan);
    const res = await fetch(`/api/billing/subscribe?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const d = await res.json();
    setSubscribing(null);
    if (d.confirmationUrl) window.top.location.href = d.confirmationUrl;
    else setToast(d.error || "Subscription failed");
  };

  if (!billing) return (
    <Page title="Settings"><Card><Box padding="400"><Text>Loading...</Text></Box></Card></Page>
  );

  const planBadgeTone = billing.plan === "enterprise" ? "success" : billing.plan === "pro" ? "success" : billing.plan === "starter" ? "info" : undefined;

  return (
    <Frame>
      <Page title="Settings" backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}>
        <Layout>

          {/* Plans */}
          <Layout.Section>
            <Text variant="headingMd" as="h2">Plans</Text>
          </Layout.Section>
          {Object.entries(PLANS).map(([key, plan]) => (
            <Layout.Section variant="oneThird" key={key}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">{plan.name}</Text>
                    {key === billing.plan && <Badge tone="success">Current</Badge>}
                  </InlineStack>
                  <Text variant="headingXl">{plan.price === 0 ? "Free" : `$${plan.price}/mo`}</Text>
                  {plan.features.map(f => (
                    <Text key={f} variant="bodySm">{f}</Text>
                  ))}
                  {key !== "free" && key !== billing.plan && (
                    <Button variant="primary" loading={subscribing === key} onClick={() => handleSubscribe(key)}>
                      Upgrade to {plan.name}
                    </Button>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}

          {/* Terms & Conditions */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Terms &amp; Conditions</Text>
                <Text variant="bodySm" tone="subdued">
                  These T&amp;Cs are displayed on your corporate accounts page and must be accepted by applicants.
                  {billing.plan === "free" || billing.plan === "starter" ? " Upgrade to Pro to use the full T&Cs builder." : ""}
                </Text>
                <TextField
                  label="Terms and conditions text"
                  value={termsAndConditions}
                  onChange={setTermsAndConditions}
                  multiline={12}
                  placeholder="Enter your terms and conditions here. Leave blank to use the default template shown in the theme extension."
                  autoComplete="off"
                  disabled={billing.plan === "free"}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Bank Details */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Bank Details (BACS)</Text>
                <Text variant="bodySm" tone="subdued">Displayed in the bank details section of your corporate accounts page.</Text>
                <InlineStack gap="400" wrap>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <TextField label="Bank name" value={bankName} onChange={setBankName} autoComplete="off" />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <TextField label="Account name" value={bankAccountName} onChange={setBankAccountName} autoComplete="off" />
                  </div>
                </InlineStack>
                <InlineStack gap="400" wrap>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <TextField label="Account number" value={bankAccountNumber} onChange={setBankAccountNumber} autoComplete="off" />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <TextField label="Sort code" value={bankSortCode} onChange={setBankSortCode} placeholder="00-00-00" autoComplete="off" />
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <TextField label="IBAN (optional)" value={bankIban} onChange={setBankIban} autoComplete="off" />
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Spend Tier Options */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Spend Tier Options</Text>
                <Text variant="bodySm" tone="subdued">These appear as dropdown options in the application form. One option per line.</Text>
                <TextField
                  label="Spend tiers"
                  value={spendTierOptions}
                  onChange={setSpendTierOptions}
                  multiline={6}
                  placeholder={"Under $1,000\n$1,000 - $5,000\n$5,000 - $15,000\n$15,000 - $35,000\n$35,000+"}
                  autoComplete="off"
                  helpText="One option per line"
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Welcome Email Template */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Welcome Email Template</Text>
                <Text variant="bodySm" tone="subdued">
                  Sent to applicants when their account is approved. Use {`{{contactName}}`}, {`{{companyName}}`}, {`{{discount}}`} as placeholders. Leave blank for the default message.
                </Text>
                <TextField
                  label="Email body"
                  value={welcomeEmailTemplate}
                  onChange={setWelcomeEmailTemplate}
                  multiline={8}
                  placeholder={"Dear {{contactName}},\n\nYour corporate account for {{companyName}} has been approved..."}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Save */}
          <Layout.Section>
            <InlineStack align="end">
              <Button variant="primary" loading={saving} onClick={handleSave}>Save settings</Button>
            </InlineStack>
          </Layout.Section>

        </Layout>
        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
