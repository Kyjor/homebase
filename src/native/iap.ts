import {
  acknowledgePurchase,
  getProducts,
  getProductStatus,
  onPurchaseUpdated,
  purchase,
  restorePurchases,
  PurchaseState,
  type Product,
  type Purchase,
} from "@choochmeque/tauri-plugin-iap-api";

/**
 * Must match App Store Connect auto-renewable subscription product id.
 */
export const SUBSCRIPTION_PRODUCT_ID = "homebase_monthly";
export const PRODUCT_TYPE = "subs" as const;

export type PurchaseResult =
  | { ok: true; mock?: boolean; pending?: boolean }
  | { ok: false; reason: string };

const ACCOUNT_TOKEN_KEY = "homebase_iap_account_token";
const ENTITLED_KEY = "homebase_subscription_entitled";

export function getIapAccountToken(): string {
  try {
    const existing = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const token = crypto.randomUUID();
    localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
    return token;
  } catch {
    return "00000000-0000-4000-8000-000000000001";
  }
}

function obfuscateId(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return `hb_${(h >>> 0).toString(16)}_${value.replace(/-/g, "").slice(0, 24)}`.slice(0, 64);
}

async function acknowledgeIfNeeded(p: Purchase): Promise<void> {
  if (!p.purchaseToken) return;
  if (p.isAcknowledged) return;
  try {
    await acknowledgePurchase(p.purchaseToken);
  } catch {
    /* iOS no-op; Android may retry later */
  }
}

function purchaseExpiration(p: Purchase): number | undefined {
  const ext = p as Purchase & { expirationTime?: number };
  return typeof ext.expirationTime === "number" ? ext.expirationTime : undefined;
}

function isActiveSubscription(p: Purchase): boolean {
  if (p.productId !== SUBSCRIPTION_PRODUCT_ID) return false;
  if (p.purchaseState !== PurchaseState.PURCHASED) return false;
  const exp = purchaseExpiration(p);
  if (typeof exp === "number" && exp > 0) return exp > Date.now();
  return true;
}

export function getCachedEntitlement(): boolean {
  try {
    return localStorage.getItem(ENTITLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCachedEntitlement(entitled: boolean): void {
  try {
    if (entitled) localStorage.setItem(ENTITLED_KEY, "1");
    else localStorage.removeItem(ENTITLED_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchSubscriptionProduct(): Promise<Product | null> {
  try {
    const { products } = await getProducts([SUBSCRIPTION_PRODUCT_ID], PRODUCT_TYPE);
    return products.find((p) => p.productId === SUBSCRIPTION_PRODUCT_ID) ?? products[0] ?? null;
  } catch {
    return null;
  }
}

export async function purchaseSubscription(): Promise<PurchaseResult> {
  try {
    const token = getIapAccountToken();
    const result = await purchase(SUBSCRIPTION_PRODUCT_ID, PRODUCT_TYPE, {
      appAccountToken: token,
      obfuscatedAccountId: obfuscateId(token),
      obfuscatedProfileId: obfuscateId(`${token}-device`),
    });

    if (result.purchaseState === PurchaseState.PENDING) {
      return { ok: true, pending: true };
    }
    if (result.purchaseState === PurchaseState.CANCELED) {
      return { ok: false, reason: "canceled" };
    }
    if (result.productId !== SUBSCRIPTION_PRODUCT_ID) {
      return { ok: false, reason: "unexpected_product" };
    }

    await acknowledgeIfNeeded(result);
    setCachedEntitlement(true);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|user.?cancel|payment.?cancelled/i.test(msg)) {
      return { ok: false, reason: "canceled" };
    }
    if (/not available|unsupported|plugin|webview/i.test(msg)) {
      return { ok: false, reason: "iap_unavailable" };
    }
    return { ok: false, reason: msg || "purchase_failed" };
  }
}

export async function restoreSubscription(): Promise<PurchaseResult> {
  try {
    const status = await getProductStatus(SUBSCRIPTION_PRODUCT_ID, PRODUCT_TYPE);
    if (status.isOwned && status.purchaseState !== PurchaseState.CANCELED) {
      if (typeof status.expirationTime === "number" && status.expirationTime > 0) {
        if (status.expirationTime <= Date.now()) {
          setCachedEntitlement(false);
          return { ok: false, reason: "expired" };
        }
      }
      if (status.purchaseToken && status.isAcknowledged === false) {
        try {
          await acknowledgePurchase(status.purchaseToken);
        } catch {
          /* ignore */
        }
      }
      setCachedEntitlement(true);
      return { ok: true };
    }

    const { purchases } = await restorePurchases(PRODUCT_TYPE);
    const owned = purchases.find(isActiveSubscription);
    if (!owned) {
      setCachedEntitlement(false);
      return { ok: false, reason: "not_found" };
    }
    await acknowledgeIfNeeded(owned);
    setCachedEntitlement(true);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not available|unsupported|plugin|webview/i.test(msg)) {
      return { ok: false, reason: "iap_unavailable" };
    }
    return { ok: false, reason: msg || "restore_failed" };
  }
}

export async function syncSubscriptionFromStore(): Promise<boolean> {
  const res = await restoreSubscription();
  return res.ok === true && !("mock" in res && res.mock);
}

export async function listenForSubscriptionPurchases(
  onSubscribed: () => void | Promise<void>,
): Promise<() => void> {
  try {
    const listener = await onPurchaseUpdated(async (p) => {
      if (!isActiveSubscription(p)) return;
      await acknowledgeIfNeeded(p);
      setCachedEntitlement(true);
      await onSubscribed();
    });
    return () => {
      void listener.unregister();
    };
  } catch {
    return () => {};
  }
}

export async function mockSubscription(): Promise<PurchaseResult> {
  setCachedEntitlement(true);
  return { ok: true, mock: true };
}

/** Vite DEV, or VITE_SUBSCRIPTION_BYPASS=true baked into the build. */
export function isDevBypassEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  const flag = String(import.meta.env.VITE_SUBSCRIPTION_BYPASS ?? "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function isDevMockAllowed(): boolean {
  return isDevBypassEnabled();
}
