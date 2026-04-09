import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Page, Layout, Card, Banner, Button, Text, BlockStack, InlineStack, Badge, DataTable, Spinner, Box } from "@shopify/polaris";

export default function Dashboard() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";
  const [billing, setBilling] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
      fetch(`/api/applications?shop=${shop}&page=1`).then(r => r.json()),
    ])
      .then(([b, a]) => { setBilling(b); setRecentApps(a.applications || []); })
      .finally(() => setLoading(false));
  }, [shop]);

  if (loading) return (
    <Page title="Corporate Accounts">
      <Layout><Layout.Section><Card><Box padding="800"><InlineStack align="center"><Spinner size="large" /></InlineStack></Box></Card></Layout.Section></Layout>
    </Page>
  );

  const planBadgeTone = billing?.plan === "enterprise" ? "success" : billing?.plan === "pro" ? "success" : billing?.plan === "starter" ? "info" : undefined;
  const pendingApps = recentApps.filter(a => a.status === "pending");
  const approvedApps = recentApps.filter(a => a.status === "approved");

  return (
    <Page title="Corporate Accounts — B2B Portal" primaryAction={{ content: "View applications", onAction: () => navigate(`/applications?shop=${shop}`) }}>
      <Layout>
        {billing?.pendingCount > 0 && (
          <Layout.Section>
            <Banner title={`${billing.pendingCount} application${billing.pendingCount > 1 ? "s" : ""} awaiting review`} tone="warning" action={{ content: "Review now", onAction: () => navigate(`/applications?shop=${shop}&status=pending`) }}>
              New corporate account applications need your attention.
            </Banner>
          </Layout.Section>
        )}
        {billing?.plan === "free" && billing?.approvedCount >= 2 && (
          <Layout.Section>
            <Banner title="Approaching free plan limit" tone="info" action={{ content: "Upgrade plan", onAction: () => navigate(`/settings?shop=${shop}`) }}>
              You have {3 - billing.approvedCount} account slot{3 - billing.approvedCount !== 1 ? "s" : ""} remaining on the Free plan.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Current Plan</Text>
              <Badge tone={planBadgeTone}>{billing?.plan?.charAt(0).toUpperCase() + billing?.plan?.slice(1) || "Free"}</Badge>
              <Text variant="bodySm" tone="subdued">{billing?.price === 0 ? "Free" : `$${billing?.price}/month`}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Pending Applications</Text>
              <Text variant="headingXl" as="p">{billing?.pendingCount ?? 0}</Text>
              <Button variant="plain" onClick={() => navigate(`/applications?shop=${shop}&status=pending`)}>Review</Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Approved Accounts</Text>
              <Text variant="headingXl" as="p">{billing?.approvedCount ?? 0}</Text>
              {billing?.accountLimit && (
                <Text variant="bodySm" tone="subdued">of {billing.accountLimit} allowed</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Recent Activity</Text>
                <Button variant="plain" onClick={() => navigate(`/applications?shop=${shop}`)}>View all</Button>
              </InlineStack>
              {recentApps.length === 0 ? (
                <Text tone="subdued">No applications yet. Share your corporate accounts page to get started.</Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Company", "Contact", "Spend", "Status", "Date"]}
                  rows={recentApps.slice(0, 5).map(a => [
                    a.companyName,
                    a.contactName,
                    a.estimatedMonthlySpend || "—",
                    <Badge key={a.id} tone={a.status === "approved" ? "success" : a.status === "rejected" ? "critical" : a.status === "suspended" ? "warning" : undefined}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</Badge>,
                    new Date(a.createdAt).toLocaleDateString("en-GB"),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
