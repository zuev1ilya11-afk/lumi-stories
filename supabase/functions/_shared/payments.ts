export type StarPaymentStatus = 'pending' | 'approved' | 'paid' | 'refunded';

export type StarPaymentOrder = {
  id: string;
  playerId: string;
  productId: string;
  currency: 'XTR';
  amount: number;
  invoicePayload: string;
  status: StarPaymentStatus;
  preCheckoutQueryId?: string;
  telegramPaymentChargeId?: string;
  providerPaymentChargeId?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
};

type StarPaymentRow = {
  id: string;
  player_id: string;
  product_id: string;
  currency: 'XTR';
  amount: number;
  invoice_payload: string;
  status: StarPaymentStatus;
  pre_checkout_query_id: string | null;
  telegram_payment_charge_id: string | null;
  provider_payment_charge_id: string | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
};

export interface StarPaymentStore {
  createOrder(playerId: string, productId: string, amount: number): Promise<StarPaymentOrder>;
  findByPayload(payload: string): Promise<StarPaymentOrder | null>;
  approveOrder(order: StarPaymentOrder, preCheckoutQueryId: string): Promise<StarPaymentOrder | null>;
  markPaid(order: StarPaymentOrder, telegramPaymentChargeId: string, providerPaymentChargeId: string): Promise<boolean>;
  markRefunded(order: StarPaymentOrder, telegramPaymentChargeId: string): Promise<boolean>;
  hasPaidSeason(playerId: string): Promise<boolean>;
  setSeasonOwned(playerId: string, owned: boolean): Promise<void>;
  createSupportRequest(telegramUserId: number, messageText: string): Promise<void>;
}

type FetchLike = typeof fetch;

const PAYMENT_SELECT = [
  'id',
  'player_id',
  'product_id',
  'currency',
  'amount',
  'invoice_payload',
  'status',
  'pre_checkout_query_id',
  'telegram_payment_charge_id',
  'provider_payment_charge_id',
  'created_at',
  'paid_at',
  'refunded_at',
].join(',');

function paymentFromRow(row: StarPaymentRow): StarPaymentOrder {
  return {
    id: row.id,
    playerId: row.player_id,
    productId: row.product_id,
    currency: row.currency,
    amount: row.amount,
    invoicePayload: row.invoice_payload,
    status: row.status,
    ...(row.pre_checkout_query_id ? { preCheckoutQueryId: row.pre_checkout_query_id } : {}),
    ...(row.telegram_payment_charge_id ? { telegramPaymentChargeId: row.telegram_payment_charge_id } : {}),
    ...(row.provider_payment_charge_id ? { providerPaymentChargeId: row.provider_payment_charge_id } : {}),
    createdAt: row.created_at,
    ...(row.paid_at ? { paidAt: row.paid_at } : {}),
    ...(row.refunded_at ? { refundedAt: row.refunded_at } : {}),
  };
}

async function readRows<T>(response: Response): Promise<T[]> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Supabase payments API ' + response.status + ': ' + body.slice(0, 300));
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Supabase payments API returned a non-array response');
  return data as T[];
}

async function requireOk(response: Response, label: string): Promise<void> {
  if (response.ok) return;
  const body = await response.text();
  throw new Error(label + ' ' + response.status + ': ' + body.slice(0, 300));
}

export function createStarPaymentStore(
  supabaseUrl: string,
  secretKey: string,
  fetcher: FetchLike = fetch,
): StarPaymentStore {
  const root = supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: secretKey,
    'Content-Type': 'application/json',
  };

  async function findByPayload(payload: string): Promise<StarPaymentOrder | null> {
    const query = new URLSearchParams({
      invoice_payload: 'eq.' + payload,
      select: PAYMENT_SELECT,
      limit: '1',
    });
    const response = await fetcher(root + '/rest/v1/star_payments?' + query.toString(), { headers });
    const [row] = await readRows<StarPaymentRow>(response);
    return row ? paymentFromRow(row) : null;
  }

  return {
    async createOrder(playerId, productId, amount) {
      const id = crypto.randomUUID();
      const invoicePayload = 'lumi:' + productId.replace(/[^a-z0-9:-]/gi, '-') + ':' + id;
      const response = await fetcher(
        root + '/rest/v1/star_payments?select=' + encodeURIComponent(PAYMENT_SELECT),
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            id,
            player_id: playerId,
            product_id: productId,
            currency: 'XTR',
            amount,
            invoice_payload: invoicePayload,
            status: 'pending',
          }),
        },
      );
      const [row] = await readRows<StarPaymentRow>(response);
      if (!row) throw new Error('Payment order insert returned no row');
      return paymentFromRow(row);
    },

    findByPayload,

    async approveOrder(order, preCheckoutQueryId) {
      if (order.status === 'approved' && order.preCheckoutQueryId === preCheckoutQueryId) return order;
      if (order.status !== 'pending') return null;

      const query = new URLSearchParams({
        id: 'eq.' + order.id,
        status: 'eq.pending',
        select: PAYMENT_SELECT,
      });
      const response = await fetcher(root + '/rest/v1/star_payments?' + query.toString(), {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'approved',
          pre_checkout_query_id: preCheckoutQueryId,
        }),
      });
      const [row] = await readRows<StarPaymentRow>(response);
      if (row) return paymentFromRow(row);

      const current = await findByPayload(order.invoicePayload);
      return current?.status === 'approved' && current.preCheckoutQueryId === preCheckoutQueryId
        ? current
        : null;
    },

    async markPaid(order, telegramPaymentChargeId, providerPaymentChargeId) {
      const query = new URLSearchParams({
        id: 'eq.' + order.id,
        status: 'in.(pending,approved)',
        select: PAYMENT_SELECT,
      });
      const response = await fetcher(root + '/rest/v1/star_payments?' + query.toString(), {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'paid',
          telegram_payment_charge_id: telegramPaymentChargeId,
          provider_payment_charge_id: providerPaymentChargeId || null,
          paid_at: new Date().toISOString(),
        }),
      });
      const [row] = await readRows<StarPaymentRow>(response);
      if (row) return true;

      const current = await findByPayload(order.invoicePayload);
      if (
        current?.status === 'paid' &&
        current.telegramPaymentChargeId === telegramPaymentChargeId
      ) return false;
      throw new Error('PAYMENT_STATE_CONFLICT');
    },

    async markRefunded(order, telegramPaymentChargeId) {
      const query = new URLSearchParams({
        id: 'eq.' + order.id,
        status: 'eq.paid',
        telegram_payment_charge_id: 'eq.' + telegramPaymentChargeId,
        select: PAYMENT_SELECT,
      });
      const response = await fetcher(root + '/rest/v1/star_payments?' + query.toString(), {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
        }),
      });
      const [row] = await readRows<StarPaymentRow>(response);
      if (row) return true;

      const current = await findByPayload(order.invoicePayload);
      if (
        current?.status === 'refunded' &&
        current.telegramPaymentChargeId === telegramPaymentChargeId
      ) return false;
      throw new Error('REFUND_STATE_CONFLICT');
    },

    async hasPaidSeason(playerId) {
      const query = new URLSearchParams({
        player_id: 'eq.' + playerId,
        product_id: 'eq.season-1',
        status: 'eq.paid',
        select: 'id',
        limit: '1',
      });
      const response = await fetcher(root + '/rest/v1/star_payments?' + query.toString(), { headers });
      const rows = await readRows<{ id: string }>(response);
      return rows.length > 0;
    },

    async setSeasonOwned(playerId, owned) {
      const query = new URLSearchParams({ id: 'eq.' + playerId });
      const response = await fetcher(root + '/rest/v1/players?' + query.toString(), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ season_1_owned: owned }),
      });
      await requireOk(response, 'Supabase player ownership update');
    },

    async createSupportRequest(telegramUserId, messageText) {
      const response = await fetcher(root + '/rest/v1/payment_support_requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          telegram_user_id: telegramUserId,
          message_text: messageText,
        }),
      });
      await requireOk(response, 'Supabase payment support insert');
    },
  };
}
