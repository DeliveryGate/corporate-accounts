import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, Tabs, DataTable, Badge, Button, TextField,
  Modal, Text, BlockStack, InlineStack, Banner, Toast, Frame,
  Spinner, Box, Select,
} from "@shopify/polaris";

const STATUS_TABS = [
  { id: "all", content: "All" },
  { id: "pending", content: "Pending" },
  { id: "approved", content: "Approved" },
  { id: "rejected", content: "Rejected" },
  { id: "suspended", content: "Suspended" },
];

const STATUS_OPTIONS = ["pending", "approved", "rejected", "suspended"];

function statusBadgeTone(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "critical";
  if (status === "suspended") return "warning";
  return undefined;
}

export default function Applications() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";
  const initialStatus = new URLSearchParams(window.location.search).get("status") || "all";

  const [selectedTab, setSelectedTab] = useState(STATUS_TABS.findIndex(t => t.id === initialStatus) || 0);
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");

  const [activeApp, setActiveApp] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view | approve
  const [customDiscount, setCustomDiscount] = useState("0");
  const [customPricingNotes, setCustomPricingNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  const statusFilter = STATUS_TABS[selectedTab]?.id;

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ shop, page });
    if (statusFilter && statusFilter !== "all") qs.set("status", statusFilter);
    const [appsRes, billingRes] = await Promise.all([
      fetch(`/api/applications?${qs}`).then(r => r.json()),
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
    ]);
    setApplications(appsRes.applications || []);
    setTotal(appsRes.total || 0);
    setPlan(billingRes.plan || "free");
    setLoading(false);
  }, [shop, page, statusFilter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const openModal = (app, mode = "view") => {
    setActiveApp(app);
    setModalMode(mode);
    setCustomDiscount(String(app.customDiscount || 0));
    setCustomPricingNotes(app.customPricingNotes || "");
    setModalOpen(true);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    const res = await fetch(`/api/applications/${activeApp.id}/approve?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDiscount, customPricingNotes }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (data.upgrade) { setUpgradeNeeded(true); return; }
    setModalOpen(false);
    setToast("Application approved");
    fetchApplications();
  };

  const handleStatusChange = async (id, action) => {
    const res = await fetch(`/api/applications/${id}/${action}?shop=${shop}`, { method: "POST" });
    if (res.ok) { setToast(`Account ${action}ed`); fetchApplications(); }
    else setToast("Action failed");
  };

  const rows = applications.map(a => [
    a.companyName,
    a.contactName,
    a.email,
    a.estimatedMonthlySpend || "—",
    <Badge key={`st-${a.id}`} tone={statusBadgeTone(a.status)}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</Badge>,
    new Date(a.createdAt).toLocaleDateString("en-GB"),
    <InlineStack key={`ac-${a.id}`} gap="200">
      <Button size="slim" onClick={() => openModal(a, "view")}>View</Button>
      {a.status === "pending" && (
        <Button size="slim" variant="primary" onClick={() => openModal(a, "approve")}>Approve</Button>
      )}
      {a.status === "pending" && (
        <Button size="slim" tone="critical" onClick={() => handleStatusChange(a.id, "reject")}>Reject</Button>
      )}
      {a.status === "approved" && (
        <Button size="slim" tone="critical" onClick={() => handleStatusChange(a.id, "suspend")}>Suspend</Button>
      )}
    </InlineStack>,
  ]);

  return (
    <Frame>
      <Page title="Applications" backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}>
        <Layout>
          {upgradeNeeded && (
            <Layout.Section>
              <Banner title="Free plan limit reached" tone="warning" action={{ content: "Upgrade", onAction: () => navigate(`/settings?shop=${shop}`) }} onDismiss={() => setUpgradeNeeded(false)}>
                Upgrade to Starter or above to approve more than 3 accounts.
              </Banner>
            </Layout.Section>
          )}
          {plan === "free" && (
            <Layout.Section>
              <Banner title="Upgrade for unlimited accounts" tone="info" action={{ content: "See plans", onAction: () => navigate(`/settings?shop=${shop}`) }}>
                The Free plan allows up to 3 approved accounts. Upgrade to Starter for unlimited.
              </Banner>
            </Layout.Section>
          )}
          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={STATUS_TABS} selected={selectedTab} onSelect={(i) => { setSelectedTab(i); setPage(1); }} />
              {loading ? (
                <Box padding="800"><InlineStack align="center"><Spinner /></InlineStack></Box>
              ) : applications.length === 0 ? (
                <Box padding="600"><Text tone="subdued">No applications found.</Text></Box>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                  headings={["Company", "Contact", "Email", "Est. Spend", "Status", "Received", "Actions"]}
                  rows={rows}
                  footerContent={`${total} total application${total !== 1 ? "s" : ""}`}
                />
              )}
            </Card>
          </Layout.Section>
          {total > 20 && (
            <Layout.Section>
              <InlineStack gap="200" align="center">
                <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Text>Page {page} of {Math.ceil(total / 20)}</Text>
                <Button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
              </InlineStack>
            </Layout.Section>
          )}
        </Layout>

        {activeApp && (
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={modalMode === "approve" ? `Approve: ${activeApp.companyName}` : activeApp.companyName}
            primaryAction={modalMode === "approve" ? { content: "Approve account", loading: actionLoading, onAction: handleApprove } : undefined}
            secondaryActions={[{ content: "Close", onAction: () => setModalOpen(false) }]}
          >
            <Modal.Section>
              <BlockStack gap="300">
                <InlineStack gap="400" wrap>
                  <BlockStack gap="100"><Text variant="headingSm">Company</Text><Text>{activeApp.companyName}</Text></BlockStack>
                  <BlockStack gap="100"><Text variant="headingSm">Contact</Text><Text>{activeApp.contactName}</Text></BlockStack>
                  <BlockStack gap="100"><Text variant="headingSm">Position</Text><Text>{activeApp.position || "—"}</Text></BlockStack>
                </InlineStack>
                <InlineStack gap="400" wrap>
                  <BlockStack gap="100"><Text variant="headingSm">Email</Text><Text>{activeApp.email}</Text></BlockStack>
                  <BlockStack gap="100"><Text variant="headingSm">Phone</Text><Text>{activeApp.phone}</Text></BlockStack>
                  <BlockStack gap="100"><Text variant="headingSm">Est. Monthly Spend</Text><Text>{activeApp.estimatedMonthlySpend || "—"}</Text></BlockStack>
                </InlineStack>
                <BlockStack gap="100"><Text variant="headingSm">Delivery Address</Text><Text>{activeApp.deliveryAddress}</Text></BlockStack>
                {activeApp.billingAddress && <BlockStack gap="100"><Text variant="headingSm">Billing Address</Text><Text>{activeApp.billingAddress}</Text></BlockStack>}
                {activeApp.notes && <BlockStack gap="100"><Text variant="headingSm">Notes</Text><Text>{activeApp.notes}</Text></BlockStack>}
                {(modalMode === "approve" || activeApp.status === "approved") && (
                  <>
                    <TextField
                      label="Discount percentage"
                      type="number"
                      value={customDiscount}
                      onChange={setCustomDiscount}
                      suffix="%"
                      helpText="Applied to all orders for this account"
                      autoComplete="off"
                      disabled={modalMode !== "approve"}
                    />
                    <TextField
                      label="Custom pricing notes"
                      value={customPricingNotes}
                      onChange={setCustomPricingNotes}
                      multiline={3}
                      helpText="Internal notes about this account's pricing arrangement"
                      autoComplete="off"
                      disabled={modalMode !== "approve"}
                    />
                  </>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
