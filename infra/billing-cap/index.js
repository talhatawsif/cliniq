// Budget alert -> Pub/Sub -> this function. When spend reaches the budget, detach billing from the
// project (Cloud Run stops). Re-attach in the console to recover. Billing data lags by hours.
const PROJECT = process.env.GCP_PROJECT;

exports.capBilling = async (event) => {
  const msg = JSON.parse(Buffer.from(event.data?.message?.data ?? event.data, "base64").toString());
  if (msg.costAmount < msg.budgetAmount) return console.log(`cost ${msg.costAmount} < budget ${msg.budgetAmount}`);
  const meta = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
  const { access_token } = await meta.json();
  const res = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ billingAccountName: "" }),
  });
  if (!res.ok) throw new Error(`detach failed: ${res.status} ${await res.text()}`);
  console.log(`billing detached from ${PROJECT}`);
};
