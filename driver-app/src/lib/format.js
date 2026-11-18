// "Gray Toyota Camry" in English, "Toyota Camry gris" in Spanish (the color comes last in Spanish).
// Same rule as the rider app, so the preview matches exactly what riders see.
export function carLine(driver, lang, t) {
  const car = `${driver.vehicle_make} ${driver.vehicle_model}`;
  if (!driver.vehicle_color || driver.vehicle_color === 'other') return car;
  const color = t(`color.${driver.vehicle_color}`);
  return lang === 'es' ? `${car} ${color.toLowerCase()}` : `${color} ${car}`;
}

// The short tags riders see under a cab: only facts that change a rider's choice.
export function riderTags(driver, t) {
  const tags = [];
  if (driver.wheelchair_accessible) tags.push(t('wheelchair'));
  if (driver.seats >= 6) tags.push(t('seats', { n: driver.seats }));
  if (!driver.payments.includes('card')) tags.push(t('cashOnly'));
  if (!driver.payments.includes('cash')) tags.push(t('cardOnly'));
  return tags;
}
