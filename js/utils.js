const Utils = (() => {
  const number = new Intl.NumberFormat('en-US');
  const longDate = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const today = (date = new Date()) => [
    date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')
  ].join('-');
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !value.startsWith('0000') && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  const digits = value => String(value).replace(/[٠-٩۰-۹]/g, char =>
    String(char.charCodeAt(0) - (char <= '٩' ? 1632 : 1776)));
  function amount(value) {
    const input = digits(value).trim().replace(/٬/g, ',');
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(input)) throw new Error('أدخل مبلغاً صحيحاً بالدينار العراقي.');
    const parsed = Number(input.replace(/,/g, ''));
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('أدخل مبلغاً موجباً ضمن النطاق المسموح.');
    return parsed;
  }
  function sum(values) {
    return values.reduce((total, value) => {
      const result = total + value;
      if (!Number.isSafeInteger(result)) throw new Error('تجاوز مجموع المبالغ النطاق المسموح.');
      return result;
    }, 0);
  }
  const money = value => `<bdi class="money">${number.format(value)} <small>IQD</small></bdi>`;
  const idLabel = (prefix, id) => `${prefix}-${String(id).padStart(5, '0')}`;
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    expenses: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-12 0v9m-6-5h18"/>',
    vouchers: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6m-6 4h6m-6 4h3"/>',
    reports: '<path d="M3 3v18h18M8 16v-4m5 4V8m5 8V5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 2.5-2 1.2-2.4-.8-2 3.5 1.9 1.7v2L2.1 15l2 3.5 2.4-.8 2 1.2L9 21h4l.5-2.1 2-1.2 2.4.8 2-3.5-1.9-1.9v-2l1.9-1.7-2-3.5-2.4.8-2-1.2L13 3z" transform="translate(1 0)"/>',
    brand: '<path d="M3 9 12 4l9 5H3Zm2 10h14M4 21h16M7 10v7m5-7v7m5-7v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    wallet: '<path d="M20 8V5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h15v-4m-17-9a2 2 0 0 0 2 2h16v7h-6a3.5 3.5 0 0 1 0-7"/><path d="M16 12.5h1"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="10" cy="10" r="5.5"/><path d="m14.5 14.5 5 5"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  function download(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  function csv(rows, filename) {
    const encode = value => {
      let cell = String(value ?? '');
      if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(cell)) cell = "'" + cell;
      return '"' + cell.replace(/"/g, '""') + '"';
    };
    download(filename, '\uFEFF' + rows.map(row => row.map(encode).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  return { number, longDate, escape, today, validDate, digits, amount, sum, money, idLabel, icon, download, csv };
})();
