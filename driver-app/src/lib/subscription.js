// What the driver's subscription means for them. Mirrors subscription_ok() in the database:
// trialing, active or past due, with 3 days of grace after the end date.

const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function subscriptionOk(driver, now = Date.now()) {
  const { subscription_status: status, subscription_ends_at: endsAt } = driver;
  if (!['trialing', 'active', 'past_due'].includes(status)) return false;
  return !endsAt || new Date(endsAt).getTime() > now - GRACE_MS;
}

// Which message to show: { key, date } where key is in src/i18n/strings.js.
export function subscriptionMessage(driver, now = Date.now()) {
  const { subscription_status: status, subscription_ends_at: endsAt } = driver;
  if (status === 'none') return { key: 'home.subNone' };
  if (!subscriptionOk(driver, now) || status === 'canceled') return { key: 'home.subEnded' };
  if (status === 'past_due') return { key: 'home.subPastDue' };
  if (status === 'trialing') return { key: 'home.subTrial', date: endsAt };
  return endsAt ? { key: 'home.subActive', date: endsAt } : { key: 'home.subActiveNoDate' };
}
