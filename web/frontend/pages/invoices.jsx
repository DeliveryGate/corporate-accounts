import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, DataTable, Badge, Button, Text, BlockStack,
  InlineStack, Banner, Toast, Frame, Spinner, Box, Modal, TextField, Select,
} from "@shopify/polaris";

function statusTone(status) {
  if (status === "paid") return "success";
  if (status === "sent") return "info";
  return undefined;
}

export default function Invoices() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [applications, setApplications] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState("");
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [invRes, billingRes, appsRes] = await Promise.all([
      fetch(`/api/invoices?shop=${shop}&page=${page}`).then(r => r.json()),
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
      fetch(`/api/applications?shop=${shop}&status=approved`).then(r => r.json()),
    ]);
    setInvoices(invRes.invoices || []);
    setTotal(invRes.total || 0);
    setPlan(billingRes.plan || "free");
    setApplications(appsRes.applications || []);
    setLoading(false);
  }, [shop, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const canGenerateInvoices = plan === "pro" || plan === "enterprise";

  const handleGenerate = async () => {
    if (!selectedApp || !invoiceMonth) return;
    setGenerating(true);
    const res = await fetch(`/api/applications/${selectedApp}/invoices?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: invoiceMonth, totalAmount: parseFloat(invoiceTotal) || 0, orders: [] }),
    });
    const data = await res.json();
    setGenerating(false);
    if (data.upgrade) {
      setModalOpen(false);
      setToast("Pro plan required for invoice generation");
      return;
    }
    if (data.id) {
      setModalOpen(false);
      setToast("Invoice generated");
      fetchData();
    } else {
      setToast(data.error || "Failed to generate invoice");
    }
  };

  const appOptions = [
    { label: "Select account...", value: "" },
    ...applications.map(a => ({ label: `${a.companyName} — ${a.contactName}`, value: a.id })),
  ];

  const rows = invoices.map(inv => [
    inv.application?.companyName || "—",
    inv.month,
    `$${inv.totalAmount.toFixed(2)}`,
    <Badge key={`s-${inv.id}`} tone={statusTone(inv.status)}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Badge>,
    new Date(inv.createdAt).toLocaleDateString("en-GB"),
  ]);

  return (
    <Frame>
      <Page
        title="Invoices"
        backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}
        primaryAction={canGenerateInvoices ? { content: "Generate invoice", onAction: () => setModalOpen(true) } : undefined}
      >
        <Layout>
          {!canGenerateInvoices && (
            <Layout.Section>
              <Banner
                title="Invoice generation requires Pro plan"
                tone="info"
                action={{ content: "Upgrade to Pro", onAction: () => navigate(`/settings?shop=${shop}`) }}
              >
                Upgrade to Pro or Enterprise to generate monthly consolidated invoices for your corporate accounts.
              </Banner>
            </Layout.Section>
          )}
          <Layout.Section>
            <Card padding="0">
              {loading ? (
                <Box padding="800"><InlineStack align="center"><Spinner /></InlineStack></Box>
              ) : invoices.length === 0 ? (
                <Box padding="600">
                  <Text tone="subdued">No invoices yet.{canGenerateInvoices ? " Generate your first invoice above." : ""}</Text>
                </Box>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text"]}
                  headings={["Account", "Month", "Total", "Status", "Created"]}
                  rows={rows}
                  footerContent={`${total} total invoice${total !== 1 ? "s" : ""}`}
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

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Generate Monthly Invoice"
          primaryAction={{ content: "Generate", loading: generating, onAction: handleGenerate }}
          secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Select
                label="Corporate account"
                options={appOptions}
                value={selectedApp}
                onChange={setSelectedApp}
              />
              <TextField
                label="Month"
                type="month"
                value={invoiceMonth}
                onChange={setInvoiceMonth}
                autoComplete="off"
                helpText="Format: YYYY-MM"
              />
              <TextField
                label="Total amount ($)"
                type="number"
                value={invoiceTotal}
                onChange={setInvoiceTotal}
                prefix="$"
                autoComplete="off"
                helpText="Total value of orders for this month"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
