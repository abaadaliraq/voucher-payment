const Vouchers = (() => {
  const e = Utils.escape;
  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
    'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر',
    'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const scales = [null, ['ألف', 'ألفان', 'آلاف'], ['مليون', 'مليونان', 'ملايين'],
    ['مليار', 'ملياران', 'مليارات'], ['تريليون', 'تريليونان', 'تريليونات'],
    ['كوادريليون', 'كوادريليونان', 'كوادريليونات']];
  const join = items => items.filter(Boolean).join(' و');
  function group(number, construct = false) {
    const remainder = number % 100;
    const hundred = construct && number === 200 ? 'مائتا' : hundreds[Math.floor(number / 100)];
    const last = remainder < 20 ? units[remainder] : join([units[remainder % 10], tens[Math.floor(remainder / 10)]]);
    return join([hundred, last]);
  }
  function words(number) {
    const parts = [];
    let scale = 0;
    while (number > 0) {
      const chunk = number % 1000;
      const names = scales[scale];
      if (chunk) {
        if (!names) parts.unshift(group(chunk));
        else if (chunk <= 2) parts.unshift(names[chunk - 1]);
        else parts.unshift(`${group(chunk, true)} ${chunk >= 3 && chunk <= 10 ? names[2] : names[0]}`);
      }
      number = Math.floor(number / 1000);
      scale++;
    }
    const value = join(parts) || 'صفر';
    return `فقط ${value} دينار عراقي لا غير`;
  }
  function document(voucher) {
    const item = voucher.snapshot;
    const settings = item.settings;
    const field = (label, content) => `<div><dt>${label}</dt><dd>${content}</dd></div>`;
    return `<article class="voucher-paper" dir="rtl">
      <header class="voucher-brand">
        ${settings.logo ? `<img src="${e(settings.logo)}" alt="">` : `<span class="voucher-mark">${Utils.icon('brand')}</span>`}
        <strong>${e(settings.name)}</strong><span class="latin">${e(settings.english)}</span>
        ${settings.contact ? `<p class="preserve">${e(settings.contact)}</p>` : ''}
      </header>
      <div class="voucher-heading"><h2>سند صرف</h2><span class="latin">PAYMENT VOUCHER</span></div>
      ${voucher.cancelled ? `<div class="void-note">سند ملغى · <bdi>${e(voucher.cancelled.date)}</bdi> · ${e(voucher.cancelled.reason)}</div>` : ''}
      <dl class="voucher-grid">
        ${field('رقم السند', `<bdi>${Utils.idLabel('PV', voucher.id)}</bdi>`)}
        ${field('تاريخ الدفع', `<bdi>${e(item.date)}</bdi>`)}
        ${field('مستلم المبلغ', e(item.recipient))}
        ${field('التصنيف', e(item.category))}
        ${field('رقم المصروف', `<bdi>${Utils.idLabel('EX', item.expenseId)}</bdi>`)}
        ${field('طريقة الدفع', Finance.methods[item.method])}
      </dl>
      <div class="voucher-description"><strong>بيان الصرف</strong><div class="preserve">${e(item.description)}</div></div>
      <div class="voucher-payment"><span>مبلغ الدفعة الحالية</span><strong>${Utils.money(item.amount)}</strong>
        <div>${words(item.amount)}</div></div>
      <dl class="voucher-grid voucher-totals">
        ${field('إجمالي قيمة المصروف', Utils.money(item.total))}
        ${field('إجمالي الدفعات السابقة', Utils.money(item.previous))}
        ${field('إجمالي المدفوع بعد الدفعة', Utils.money(item.paid))}
        ${field('المتبقي بعد الدفعة', Utils.money(item.remaining))}
      </dl>
      <div class="voucher-description"><strong>الملاحظات</strong><div class="preserve">${e(item.notes) || '—'}</div></div>
      <div class="signatures"><span>توقيع مستلم المبلغ</span><span>توقيع المحاسب / المسؤول</span></div>
    </article>`;
  }
  return { words, document };
})();
