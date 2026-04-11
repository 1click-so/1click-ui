# Known Issues

Tracked issues we are aware of but have not yet fixed. Each entry records what's broken, what the fix path looks like, and why we deferred it. The point of this file is honesty — if something is broken and we know about it, it goes here so the next session (human or AI) can find it.

Entries are sorted newest-first.

---

## Company invoice fields silently dropped during checkout

**Status:** Deferred — resolution expected within 1-2 days.
**First documented:** 2026-04-11
**Source file:** `mindpages-storefront/src/modules/checkout/templates/checkout-client/index.tsx` (around line 488, inside `saveAddress`)

### What's broken

The checkout's collapsible "Фактура за фирма" (Company Invoice) section collects four fields: `company_name`, `company_vat`, `company_mol`, `company_address`. When the form is saved, the checkout calls `updateCustomer({ ..., company_name, metadata: { company_vat, company_mol, company_address } })`.

The Medusa JS SDK's `StoreUpdateCustomer` type does not have a `company_name` field. The backend silently drops it. The metadata fields may or may not persist depending on whether the metadata system is wired for customer records (untested).

**Net effect:** customers who fill in company invoice details today see the form "accept" their input, but the data does not reach the backend reliably. Admins see no company info on orders where it was submitted.

### Why this happened

The checkout was extended with company fields without a backend endpoint or metafield plan to match. The frontend assumed the data would land somewhere; it does not. This was a coordination gap between frontend and backend, not a regression.

### Fix options

Three paths, listed from simplest to most complete:

1. **Drop the UI from checkout.** Remove the `CompanyDetails` collapsible entirely. Clean solution if company invoicing is genuinely not needed right now.
2. **Route through the existing metafield system.** The backend has a metafield module (`medusa-mindpages/src/modules/metafield`) that can attach custom fields to customer/order records. Add `company_name`, `company_vat`, `company_mol`, `company_address` as metafields on the customer entity and write to them via the metafield API. Store the same values on the order via order metadata so admins see them on each order.
3. **First-class backend support.** Add a proper `/store/customers/me/company` endpoint backed by a dedicated `customer_company` table. Clean data model, admin UI for editing, proper invoice rendering in emails. This is the right long-term answer but the biggest investment.

### Current decision

**Defer, do not remove the UI.** Keep the checkout form visible so users see the feature and we don't regress UX. Fix via option (2) — metafield-backed — within 1-2 days. Option (3) is post-launch cleanup.

### What blocks progress

- A backend decision on whether company fields live on customer, order, or both (Phase 1 roadmap says "both, separate fields, not JSON blob").
- A backend endpoint or metafield schema.

### Where this resurfaces

This issue is flagged in `docs/LIBRARY_SCOPE.md` under Phase 4 (checkout decomposition) as a blocker that must be resolved before the checkout can be cleanly extracted into the library. If the backend fix lands first, Phase 4 can extract the checkout with company fields working correctly. If Phase 4 starts first, the checkout moves into the library with company fields still silently dropped — and the entry stays here until it's fixed at the backend level.

---

<!-- New entries go above this line. Newest-first. -->
