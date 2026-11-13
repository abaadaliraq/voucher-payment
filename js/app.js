(() => {
  'use strict';
  const { escape: e, icon, money, number, idLabel } = Utils;
  const content = document.querySelector('#content');
  const dialog = document.querySelector('#modal');
  const navigation = document.querySelector('#navigation');
  const notice = document.querySelector('#notification');
  const printArea = document.querySelector('#print-area');
  const sections = {
    dashboard: 'لوحة التحكم', expenses: 'سجل المصروفات', vouchers: 'سندات الصرف',
    reports: 'التقارير المالية', settings: 'النسخ الاحتياطي والإعدادات'
  };
  const criteria = { search: '', category: '', status: '' };
  const reportCriteria = { from: '', to: '', category: '', vendor: '', status: '' };
  const published = location.protocol === 'https:' && location.hostname.endsWith('.github.io');
  const pageSize = 30;
  let state;
  let view = 'dashboard';
  let sort = { key: 'id', ascending: true };
  let page = 0;
  let voucherFilter = '';
  let expenseRows = [];
  let busy = false;
  let noticeTimer;
  const button = (label, action, id = '', style = 'secondary', symbol = '') =>
    `<button type="button" class="button ${style}" data-action="${action}" data-id="${id}">${symbol ? icon(symbol) : ''}${label}</button>`;
  const primary = (label, action, id = '', symbol = 'plus') => button(label, action, id, 'primary', symbol);
  const tag = status => `<span class="badge ${status}">${Finance.statuses[status]}</span>`;
  const voucherTag = voucher => `<span class="badge ${voucher.cancelled ? 'unpaid' : 'paid'}">${voucher.cancelled ? 'ملغى' : 'صادر'}</span>`;
  const date = value => `<bdi class="date">${e(value)}</bdi>`;
  const label = (key, id) => `<bdi class="serial">${idLabel(key, id)}</bdi>`;
  const option = (value, text, selected) =>
    `<option value="${e(value)}"${String(value) === String(selected) ? ' selected' : ''}>${e(text)}</option>`;
  const categoryOptions = (selected, blank) => (blank ? option('', blank, selected) : '')
    + state.categories.map(item => option(item.id, item.name, selected)).join('');
  const statusOptions = selected => option('', 'كل الحالات', selected)
    + Object.entries(Finance.statuses).map(([key, text]) => option(key, text, selected)).join('');
  const sectionHead = (title, description, actions = '') => `<div class="section-head">
    <div><h2>${title}</h2>${description ? `<p>${description}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
  const empty = (title, description = '', action = '') => `<div class="empty">
    <span class="empty-icon">${icon('expenses')}</span><strong>${title}</strong>${description ? `<p>${description}</p>` : ''}${action}</div>`;
  const table = (headers, body, foot = '', className = '') => `<div class="table-scroll" tabindex="0"><table class="${className}">
    <thead><tr>${headers.map(header => typeof header === 'string' ? `<th scope="col">${header}</th>` : header.html).join('')}</tr></thead>
    <tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
  const input = (name, value = '', attributes = '') => `<input name="${name}" value="${e(value)}" ${attributes}>`;
  const field = (title, control, wide = false) => `<label class="field${wide ? ' wide' : ''}"><span>${title}</span>${control}</label>`;
  const textarea = (name, value, limit, attributes = '') => `<textarea name="${name}" maxlength="${limit}" ${attributes}>${e(value)}</textarea>`;
  const textValue = (data, key) => String(data.get(key) ?? '').trim();
  function flash(message, error = false) {
    clearTimeout(noticeTimer);
    notice.className = error ? 'visible error' : 'visible';
    notice.textContent = message;
    noticeTimer = setTimeout(() => { notice.className = ''; }, 5200);
  }
  function showModal(title, body, { large = false, form = '', submit = 'حفظ', id = '', intro = '' } = {}) {
    dialog.classList.toggle('large', large);
    dialog.innerHTML = `<header class="modal-head"><div><h2 id="modal-title">${title}</h2>
      ${intro ? `<p>${intro}</p>` : ''}</div><button type="button" class="icon-button" data-action="close" aria-label="إغلاق">${icon('close')}</button></header>
      ${form ? `<form data-form="${form}" data-id="${id}"><div class="modal-body">${body}<p class="form-error" role="alert" hidden></p></div>
      <footer class="modal-footer">${button('رجوع', 'close')}<button class="button primary" type="submit">${submit}</button></footer></form>`
      : `<div class="modal-body">${body}</div>`}`;
    if (!dialog.open) dialog.showModal();
    else dialog.querySelector('.modal-head button').focus();
    dialog.scrollTop = 0;
  }
  function showError(form, error) {
    const target = form?.querySelector('.form-error');
    const message = error?.message || 'تعذّر إكمال العملية.';
    if (!target) return flash(message, true);
    target.hidden = false;
    target.textContent = message;
    target.scrollIntoView({ block: 'nearest' });
  }
  function cards(items, counts = false) {
    const totals = Finance.summary(items);
    const data = [
      ['إجمالي المصروفات', money(totals.total), 'wallet', ''],
      ['إجمالي المدفوع', money(totals.paid), 'check', 'green'],
      ['إجمالي المتبقي', money(totals.remaining), 'clock', 'gold']
    ];
    if (counts) data.push(['المصروفات المسجلة', number.format(items.length), 'expenses', ''],
      ['سندات الصرف الصادرة', number.format(state.vouchers.length), 'vouchers', '']);
    return `<div class="stats ${counts ? 'five' : ''}">${data.map(([title, value, symbol, color]) => `<article class="stat">
      <div class="stat-head"><span>${title}</span><span class="stat-icon ${color}">${icon(symbol)}</span></div>
      <strong class="${color}">${value}</strong></article>`).join('')}</div>`;
  }
  function dashboard() {
    const totals = Finance.summary(expenseRows);
    const distribution = Reports.breakdown(expenseRows)[0].rows;
    const operations = [
      ...expenseRows.map(item => ({ ...item, amount: item.total, expenseId: item.id, title: item.description, type: 'مصروف' })),
      ...state.payments.map(item => ({ ...item, title: item.recipient, type: 'دفعة' }))
    ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 7);
    return `${sectionHead('ملخص المصروفات', 'تابع المصروفات والدفعات والأرصدة المستحقة.', published ? '' : primary('مصروف جديد', 'expense-new'))}
      ${cards(expenseRows, true)}
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-head"><div><h3>آخر العمليات المالية</h3><p>المصروفات والدفعات بحسب تاريخ العملية</p></div>
          ${button('عرض السجل', 'nav-expenses', '', 'quiet', 'arrow')}</div>
          ${operations.length ? table(['العملية', 'التاريخ', 'المبلغ'], operations.map(item => `<tr>
            <td><button class="link" data-action="details" data-id="${item.expenseId}">${e(item.title)}</button><small class="block muted">${item.type}</small></td>
            <td>${date(item.date)}</td><td>${money(item.amount)}</td></tr>`).join(''))
            : empty('لا توجد عمليات مالية بعد', published ? 'تظهر العمليات عند تحديث ملف السجل المنشور.' : 'أضف أول مصروف لبدء تسجيل الدفعات وإصدار السندات.',
              published ? '' : button('إضافة أول مصروف', 'expense-new', '', 'secondary', 'plus'))}
        </section>
        <section class="panel"><div class="panel-head"><div><h3>توزيع المصروفات</h3><p>حصة كل تصنيف من إجمالي المصروفات</p></div><span class="panel-icon">${icon('reports')}</span></div>
          ${distribution.length ? `<ul class="distribution">${distribution.map(item => {
            const percent = item.total / totals.total * 100;
            return `<li><div><span>${e(item.name)}</span><bdi>${number.format(Math.round(percent * 10) / 10)}%</bdi></div>
              <div class="track"><span style="width:${percent}%"></span></div>${money(item.total)}</li>`;
          }).join('')}</ul>` : `<div class="chart-empty"><div class="donut"><div><strong>0</strong><small>تصنيف نشط</small></div></div>
            <p>يظهر التوزيع عند تسجيل المصروفات.</p></div>`}
        </section>
      </div>`;
  }
  const columns = [
    ['id', 'الرقم'], ['date', 'التاريخ'], ['category', 'التصنيف'], ['description', 'البيان'], ['vendor', 'الجهة / المورد'],
    ['total', 'المبلغ الإجمالي'], ['paid', 'المبلغ المدفوع'], ['remaining', 'المبلغ المتبقي'], ['status', 'الحالة']
  ];
  function expenseTable(items, { interactive = false, totals = items, pagination = false } = {}) {
    const headers = columns.map(([key, title]) => {
      if (!interactive) return title;
      const current = sort.key === key;
      return { html: `<th scope="col"${current ? ` aria-sort="${sort.ascending ? 'ascending' : 'descending'}"` : ''}>
        <button class="sort" data-action="sort" data-id="${key}">${title} <span aria-hidden="true">${current ? sort.ascending ? '↑' : '↓' : '↕'}</span></button></th>` };
    });
    const body = items.map(item => `<tr>
      <td><button class="link" data-action="details" data-id="${item.id}">${label('EX', item.id)}</button></td><td>${date(item.date)}</td>
      <td>${e(item.category)}</td><td class="description-cell"><button class="link" data-action="details" data-id="${item.id}">${e(item.description)}</button></td>
      <td>${e(item.vendor)}</td><td>${money(item.total)}</td><td>${money(item.paid)}</td>
      <td class="${item.remaining ? 'balance' : ''}">${money(item.remaining)}</td><td>${tag(item.status)}</td>
      ${interactive ? `<td><div class="row-actions">${button('التفاصيل', 'details', item.id, 'quiet')}${published ? '' :
        button('تعديل', 'expense-edit', item.id, 'quiet') + button('حذف', 'expense-delete', item.id, 'danger-quiet')}</div></td>` : ''}</tr>`).join('');
    const total = Finance.summary(totals);
    const foot = `<tr><th colspan="5" scope="row">مجموع النتائج</th><td>${money(total.total)}</td><td>${money(total.paid)}</td>
      <td>${money(total.remaining)}</td><td colspan="${interactive ? 2 : 1}"></td></tr>`;
    return table(interactive ? [...headers, 'الإجراءات'] : headers, body, foot, 'expense-table')
      + (pagination ? `<div class="pagination"><span>عرض <bdi>${number.format(items.length ? page * pageSize + 1 : 0)}–${number.format(page * pageSize + items.length)}</bdi> من <bdi>${number.format(totals.length)}</bdi></span>
        <div class="actions"><button class="button secondary" data-action="page" data-id="-1"${page === 0 ? ' disabled' : ''}>السابق</button>
        <button class="button secondary" data-action="page" data-id="1"${(page + 1) * pageSize >= totals.length ? ' disabled' : ''}>التالي</button></div></div>` : '');
  }
  function expenses() {
    return `${sectionHead('المصروفات المسجلة', 'تابع المدفوع والمتبقي لكل سجل.', published ? '' : primary('مصروف جديد', 'expense-new'))}
      <section class="panel">
        <div class="filters"><label class="field search"><span>بحث في المصروفات</span><div>${icon('search')}
          <input type="search" data-filter="search" value="${e(criteria.search)}" placeholder="ابحث بالبيان أو المورد أو الرقم"></div></label>
          ${field('التصنيف', `<select data-filter="category">${categoryOptions(criteria.category, 'كل التصنيفات')}</select>`)}
          ${field('حالة الدفع', `<select data-filter="status">${statusOptions(criteria.status)}</select>`)}
        </div><div id="expense-results"></div>
      </section>`;
  }
  function renderExpenses() {
    const list = Reports.filter(expenseRows, criteria);
    list.sort((a, b) => {
      const first = sort.key === 'status' ? Finance.statuses[a.status] : a[sort.key];
      const second = sort.key === 'status' ? Finance.statuses[b.status] : b[sort.key];
      const order = typeof first === 'number' ? first - second : first.localeCompare(second, 'ar', { numeric: true });
      return (sort.ascending ? order : -order) || b.id - a.id;
    });
    page = Math.min(page, Math.max(0, Math.ceil(list.length / pageSize) - 1));
    content.querySelector('#expense-results').innerHTML = list.length ? expenseTable(list.slice(page * pageSize, (page + 1) * pageSize),
      { interactive: true, totals: list, pagination: true }) : empty(expenseRows.length ? 'لا توجد نتائج مطابقة' : 'لا توجد مصروفات مسجلة',
        expenseRows.length ? 'غيّر البحث أو الفلاتر لعرض المزيد من السجلات.' : published ? 'أضف المصروف في ملف السجل المنشور.' : 'أضف مصروفاً لتسجيل قيمته ومتابعة دفعاته.');
  }
  function vouchers() {
    const list = state.vouchers
      .filter(item => !voucherFilter || (voucherFilter === 'cancelled') === !!item.cancelled)
      .sort((a, b) => a.id - b.id);
    return `${sectionHead('السندات المسجلة', published ? 'تظهر السندات المسجلة في ملف السجل المنشور.' : 'تُصدر سندات الصرف من الدفعات المسجلة في تفاصيل المصروف.')}
      <section class="panel"><div class="filters">${field('حالة السند', `<select id="voucher-filter">${option('', 'كل السندات', voucherFilter)}
        ${option('active', 'الصادرة', voucherFilter)}${option('cancelled', 'الملغاة', voucherFilter)}</select>`)}</div>
      ${list.length ? table(['رقم السند', 'تاريخ الدفع', 'المستلم', 'رقم الدفعة', 'قيمة السند', 'الحالة', 'الإجراءات'], list.map(item => `<tr>
        <td>${label('PV', item.id)}</td><td>${date(item.snapshot.date)}</td><td>${e(item.snapshot.recipient)}</td>
        <td>${label('PY', item.paymentId)}</td><td>${money(item.snapshot.amount)}</td><td>${voucherTag(item)}</td>
        <td>${button('معاينة', 'voucher-preview', item.id, 'quiet')}</td></tr>`).join('')) : empty('لا توجد سندات في هذا العرض')}</section>`;
  }
  function report() {
    const vendors = [...new Set(expenseRows.map(item => item.vendor))].sort((a, b) => a.localeCompare(b, 'ar'));
    return `${sectionHead('تحليل المصروفات', 'تُطبّق فترة التقرير على تاريخ تسجيل المصروف.', button('تصدير التقرير CSV', 'report-export', '', 'secondary', 'download'))}
      <section class="panel filters report-filters">
        ${field('من تاريخ', input('from', reportCriteria.from, 'type="date" data-report="from"'))}
        ${field('إلى تاريخ', input('to', reportCriteria.to, 'type="date" data-report="to"'))}
        ${field('التصنيف', `<select data-report="category">${categoryOptions(reportCriteria.category, 'كل التصنيفات')}</select>`)}
        ${field('المورد', `<select data-report="vendor">${option('', 'كل الموردين', reportCriteria.vendor)}${vendors.map(vendor => option(vendor, vendor, reportCriteria.vendor)).join('')}</select>`)}
        ${field('حالة الدفع', `<select data-report="status">${statusOptions(reportCriteria.status)}</select>`)}
      </section><div id="report-results"></div>`;
  }
  function reportItems() {
    if (reportCriteria.from && reportCriteria.to && reportCriteria.from > reportCriteria.to) throw new Error('تاريخ البداية يجب أن يسبق تاريخ النهاية أو يساويه.');
    return Reports.filter(expenseRows, reportCriteria);
  }
  function renderReport() {
    const target = content.querySelector('#report-results');
    try {
      const items = reportItems();
      const outstanding = items.filter(item => item.remaining > 0);
      target.innerHTML = `${cards(items)}
        <div class="report-grid">${Reports.breakdown(items).map(section => `<section class="panel"><div class="panel-head"><h3>المصروفات ${section.title}</h3></div>
          ${section.rows.length ? table(['المجموعة', 'العدد', 'الإجمالي', 'المدفوع', 'المتبقي'], section.rows.map(item =>
            `<tr><td><bdi>${e(item.name)}</bdi></td><td>${number.format(item.count)}</td><td>${money(item.total)}</td><td>${money(item.paid)}</td><td>${money(item.remaining)}</td></tr>`).join(''))
            : empty('لا توجد بيانات مطابقة')}</section>`).join('')}</div>
        <section class="panel"><div class="panel-head"><h3>المصروفات غير المسددة بالكامل</h3></div>
          ${outstanding.length ? expenseTable(outstanding) : empty('لا توجد مصروفات مستحقة ضمن النتائج')}</section>`;
    } catch (error) {
      target.innerHTML = `<p class="warning" role="alert">${e(error.message)}</p>`;
    }
  }
  function settings() {
    if (published) return `${sectionHead('ملف السجل المنشور', 'يُحدَّث هذا العرض عند نشر نسخة جديدة من data/ledger.js.')}
      <section class="panel"><div class="panel-body">
      ${button('تصدير سجل المصروفات CSV', 'expense-export', '', 'secondary', 'download')}</div></section>`;
    const org = state.settings;
    return `${sectionHead('إعدادات النظام', '')}
      <div class="settings-grid">
        <section class="panel"><div class="panel-head"><h3>النسخ الاحتياطي</h3><span class="panel-icon">${icon('download')}</span></div>
          <div class="panel-body"><p class="warning">تُحفظ البيانات على هذا الجهاز وفي ملف تعريف المتصفح نفسه. صدّر نسخة JSON دورياً واحفظها في مكان آمن.</p>
          <div class="actions">${button('تصدير نسخة JSON', 'backup-export', '', 'secondary', 'download')}
            ${button('تصدير ملف السجل JS', 'ledger-export', '', 'secondary', 'download')}
            ${button('استيراد نسخة JSON', 'backup-choose')}${button('تصدير سجل المصروفات CSV', 'expense-export')}</div>
          <input id="import-file" type="file" accept=".json,application/json" hidden></div>
        </section>
        <section class="panel"><div class="panel-head"><h3>بيانات المؤسسة</h3><span class="panel-icon">${icon('brand')}</span></div>
          <div class="panel-body"><strong>${e(org.name)}</strong><div class="latin muted">${e(org.english)}</div>
          ${org.contact ? `<p class="preserve">${e(org.contact)}</p>` : '<p class="muted">لم تُضف بيانات اتصال بعد.</p>'}
          ${button('تعديل البيانات والشعار', 'settings-edit')}</div>
        </section>
      </div>
      <section class="panel"><div class="panel-head"><div><h3>تصنيفات المصروفات</h3><p>ينعكس تغيير الاسم على المصروفات المرتبطة بالتصنيف.</p></div>
        ${primary('تصنيف جديد', 'category-edit')}</div>
        <ul class="category-list">${state.categories.map(item => `<li><span>${e(item.name)}</span>${button('تعديل', 'category-edit', item.id, 'quiet')}</li>`).join('')}</ul>
      </section>`;
  }
  function render() {
    expenseRows = Finance.rows(state);
    const org = state.settings;
    const brandLogo = org.logo || 'assets/logo.png';
    document.querySelector('#brand').innerHTML = `<div class="brand-mark"><img src="${e(brandLogo)}" width="43" height="43" alt=""></div>
      <div><strong>${e(org.name)}</strong><span class="latin">${e(org.english)}</span></div>`;
    navigation.innerHTML = Object.entries(sections).map(([key, title]) =>
      `<button data-action="nav-${key}" ${view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${title}</span></button>`).join('');
    document.querySelector('#section-title').textContent = sections[view];
    content.innerHTML = ({ dashboard, expenses, vouchers, reports: report, settings })[view]();
    if (view === 'expenses') renderExpenses();
    if (view === 'reports') renderReport();
    content.setAttribute('aria-busy', 'false');
  }
  const amountInput = (name, value = '', attributes = '') =>
    input(name, value === '' ? '' : number.format(value), `inputmode="numeric" dir="ltr" placeholder="0" ${attributes}`);
  function itemLine(item = { name: '', amount: '' }) {
    return `<div class="item-line">
      ${field('اسم البند', input('line-name', item.name, 'maxlength="150" required'))}
      ${field('المبلغ (IQD)', amountInput('line-amount', item.amount, 'required'))}
      <button type="button" class="icon-button remove-line" data-action="line-remove" aria-label="حذف البند">${icon('close')}</button></div>`;
  }
  function updateItemTotal() {
    const form = dialog.querySelector('[data-form="expense"]');
    const inputs = [...form.querySelectorAll('[name="line-amount"]')];
    const total = form.elements.total;
    if (inputs.length && !total.readOnly && form.dataset.manual === undefined) form.dataset.manual = total.value;
    if (!inputs.length && total.readOnly) {
      total.value = form.dataset.manual ?? '';
      delete form.dataset.manual;
    }
    total.readOnly = inputs.length > 0;
    if (!inputs.length) return;
    try {
      total.value = number.format(Utils.sum(inputs.map(control => control.value.trim() ? Utils.amount(control.value) : 0)));
    } catch {
      total.value = '';
    }
  }
  function expenseForm(id) {
    const item = id ? Finance.get(expenseRows, id) : { date: Utils.today(), items: [] };
    showModal(id ? 'تعديل المصروف' : 'مصروف جديد', `<div class="form-grid">
      ${field('تاريخ التسجيل', input('date', item.date, 'type="date" required'))}
      ${field('التصنيف', `<select name="category" required>${categoryOptions(item.categoryId, 'اختر التصنيف')}</select>`)}
      ${field('بيان المصروف', textarea('description', item.description, 500, 'required rows="2"'), true)}
      ${field('الجهة / المورد', input('vendor', item.vendor, 'maxlength="150" required'))}
      ${field('إجمالي المصروف (IQD)', amountInput('total', item.total, 'required'))}
    </div><div class="form-subhead"><div><h3>بنود المصروف</h3><p>عند إضافة بنود، يُحسب الإجمالي من مبالغها.</p></div>
      ${button('إضافة بند', 'line-add', '', 'secondary', 'plus')}</div>
    <div id="expense-lines">${item.items.map(itemLine).join('')}</div>
    ${item.paid ? `<p class="warning">المدفوع المسجل لهذا المصروف ${money(item.paid)}.</p>` : ''}`,
    { form: 'expense', submit: 'حفظ المصروف', id: id || '', intro: id ? idLabel('EX', id) : 'أدخل بيانات المصروف والمبلغ الإجمالي.' });
    updateItemTotal();
  }
  function details(id) {
    const item = Finance.get(expenseRows, id);
    const payments = Finance.paymentsFor(state, id);
    const rows = payments.map(payment => {
      const voucher = Finance.activeVoucher(state, payment.id);
      return `<tr><td>${label('PY', payment.id)}</td><td>${date(payment.date)}</td><td>${money(payment.amount)}</td>
        <td>${Finance.methods[payment.method]}</td><td>${e(payment.recipient)}</td><td class="preserve">${e(payment.notes) || '—'}</td>
        <td><div class="row-actions">${voucher ? button('عرض السند', 'voucher-preview', voucher.id, 'quiet')
          : published ? '—' : button('إصدار سند', 'voucher-issue', payment.id, 'quiet') + button('تعديل الدفعة', 'payment-edit', payment.id, 'quiet')}</div></td></tr>`;
    }).join('');
    showModal('تفاصيل المصروف', `<div class="detail-header"><div><h3 class="preserve">${e(item.description)}</h3>
      <div class="detail-meta">${date(item.date)}<span>${e(item.category)}</span><span>${e(item.vendor)}</span>${tag(item.status)}</div></div>
      ${published ? '' : button('تعديل المصروف', 'expense-edit', id)}</div>
      ${cards([item])}
      ${item.items.length ? `<div class="detail-block"><h3>بنود المصروف</h3>${table(['البند', 'المبلغ'], item.items.map(line =>
        `<tr><td>${e(line.name)}</td><td>${money(line.amount)}</td></tr>`).join(''))}</div>` : ''}
      <div class="form-subhead"><div><h3>الدفعات المسجلة</h3><p>المبلغ المتاح للدفع ${money(item.remaining)}</p></div>
        ${!published && item.remaining ? primary('تسجيل دفعة', 'payment-new', id) : ''}</div>
      ${payments.length ? table(['رقم الدفعة', 'التاريخ', 'المبلغ', 'الطريقة', 'المستلم', 'ملاحظات', 'الإجراءات'], rows)
        : empty('لا توجد دفعات لهذا المصروف')}`, { large: true, intro: label('EX', id) });
  }
  function paymentForm(expenseId, paymentId) {
    const item = Finance.get(expenseRows, expenseId);
    const payment = paymentId ? Finance.get(state.payments, paymentId) : { date: Utils.today(), recipient: item.vendor, method: 'cash' };
    showModal(paymentId ? 'تعديل الدفعة' : 'تسجيل دفعة', `<div class="form-grid">
      ${field('تاريخ الدفع', input('date', payment.date, 'type="date" required'))}
      ${field('مبلغ الدفعة (IQD)', amountInput('amount', payment.amount, 'required'))}
      ${field('طريقة الدفع', `<select name="method">${Object.entries(Finance.methods).map(([key, title]) => option(key, title, payment.method)).join('')}</select>`)}
      ${field('اسم مستلم المبلغ', input('recipient', payment.recipient, 'maxlength="150" required'))}
      ${field('ملاحظات', textarea('notes', payment.notes, 1000, 'rows="3"'), true)}
    </div><input type="hidden" name="expenseId" value="${expenseId}">
    <p class="warning">الحد المتاح لهذه الدفعة ${money(item.remaining + (payment.amount || 0))}.</p>`,
    { form: 'payment', id: paymentId || '', submit: 'حفظ الدفعة', intro: label('EX', expenseId) });
  }
  function preview(id) {
    const voucher = Finance.get(state.vouchers, id);
    const linked = state.expenses.some(item => item.id === voucher.snapshot.expenseId);
    showModal('معاينة سند الصرف', `<div class="voucher-toolbar actions">
      ${primary('طباعة السند', 'print', id, '')}${button('حفظ PDF', 'pdf', id, 'secondary', 'download')}
      ${linked ? button('تفاصيل المصروف', 'details', voucher.snapshot.expenseId) : ''}
      ${published || voucher.cancelled ? '' : button('إلغاء السند', 'voucher-cancel', id, 'danger-quiet')}
      </div>${Vouchers.document(voucher)}`, { large: true });
  }
  function confirmDelete(id) {
    const item = Finance.get(expenseRows, id);
    const count = Finance.paymentsFor(state, id).length;
    const vouchers = state.vouchers.filter(voucher => voucher.snapshot.expenseId === id && !voucher.cancelled).length;
    showModal('حذف المصروف', `<p class="preserve">${e(item.description)}</p><p class="warning">
      سيُحذف المصروف نهائياً${count ? ` مع ${number.format(count)} من الدفعات المسجلة` : ''}.
      ${vouchers ? `سيُلغى ${number.format(vouchers)} من السندات المرتبطة وتبقى أرقامها في السجل.` : ''}</p>`,
    { form: 'delete', id, submit: 'تأكيد الحذف' });
  }
  function cancelForm(id) {
    showModal('إلغاء سند الصرف', `<p class="warning">سيبقى السند الملغى في الأرشيف، وتبقى الدفعة مسجلة. يمكنك بعدها تعديل الدفعة وإصدار سند برقم جديد.</p>
      ${field('سبب الإلغاء', textarea('reason', '', 300, 'required rows="3"'))}`,
    { form: 'cancel', id, submit: 'تأكيد الإلغاء', intro: label('PV', id) });
  }
  function settingsForm() {
    const org = state.settings;
    showModal('تعديل بيانات المؤسسة', `<div class="form-grid">
      ${field('الاسم بالعربية', input('name', org.name, 'required maxlength="100"'))}
      ${field('الاسم بالإنجليزية', input('english', org.english, 'required maxlength="100" dir="ltr"'))}
      ${field('بيانات الاتصال', textarea('contact', org.contact, 250, 'rows="3"'), true)}
      ${field('الشعار (PNG أو JPEG أو WebP)', '<input type="file" name="logo" accept="image/png,image/jpeg,image/webp">', true)}
      ${org.logo ? '<label class="check-field wide"><input type="checkbox" name="removeLogo"> إزالة الشعار الحالي</label>' : ''}
    </div>`, { form: 'settings', intro: 'تظهر هذه البيانات في السندات الجديدة.' });
  }
  function readLogo(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 295_000) {
      throw new Error('اختر صورة PNG أو JPEG أو WebP بحجم أقصاه 295 كيلوبايت.');
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('تعذّرت قراءة ملف الشعار.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('ملف الشعار لا يحتوي على صورة قابلة للعرض.'));
        image.onload = () => resolve(reader.result);
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  let pendingBackup;
  async function chooseBackup(file) {
    if (!file) return;
    try {
      const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      Finance.validate(data);
      pendingBackup = data;
      showModal('استعادة نسخة احتياطية', `<p class="preserve">${e(file.name)}</p>
        <p class="warning">سيؤدي الاستيراد إلى استبدال جميع المصروفات والدفعات والسندات والإعدادات الحالية بالبيانات الموجودة في الملف.</p>
        <p>تحتوي النسخة على <bdi>${number.format(data.expenses.length)}</bdi> مصروف، و<bdi>${number.format(data.payments.length)}</bdi> دفعة،
        و<bdi>${number.format(data.vouchers.length)}</bdi> سند.</p>
        <label class="check-field"><input type="checkbox" required> أوافق على استبدال البيانات الحالية</label>`,
      { form: 'import', submit: 'استبدال البيانات' });
    } catch {
      flash('ملف النسخة الاحتياطية غير صالح. لم تُستبدل البيانات الحالية.', true);
    }
  }
  async function commit(change, expected = state.revision) {
    if (published) throw new Error('عدّل ملف السجل ثم انشر التحديث على GitHub.');
    const result = await Database.change(current => {
      if (current.revision !== expected) throw new Error('تغيّرت البيانات في نافذة أخرى. أغلق النافذة الحالية وأعد تحميل الصفحة قبل المحاولة.');
      const result = change(current);
      current.revision++;
      return result;
    });
    state = await Database.read();
    render();
    return result;
  }
  async function submitForm(event) {
    const form = event.target;
    if (!form.matches('[data-form]')) return;
    event.preventDefault();
    if (busy) return;
    const data = new FormData(form);
    const id = Number(form.dataset.id);
    const submit = form.querySelector('[type="submit"]');
    const expected = state.revision;
    busy = true;
    submit.disabled = true;
    try {
      switch (form.dataset.form) {
        case 'expense': {
          const amounts = data.getAll('line-amount');
          const items = data.getAll('line-name').map((name, index) => ({ name: name.trim(), amount: Utils.amount(amounts[index]) }));
          const total = items.length ? Utils.sum(items.map(item => item.amount)) : Utils.amount(data.get('total'));
          const expenseId = await commit(current => Finance.saveExpense(current, id, {
            date: data.get('date'), categoryId: Number(data.get('category')), description: textValue(data, 'description'),
            vendor: textValue(data, 'vendor'), total, items
          }), expected);
          details(expenseId);
          flash('تم حفظ المصروف.');
          break;
        }
        case 'payment': {
          const expenseId = Number(data.get('expenseId'));
          const payment = { date: data.get('date'), amount: Utils.amount(data.get('amount')), method: data.get('method'),
            recipient: textValue(data, 'recipient'), notes: textValue(data, 'notes') };
          await commit(current => Finance.savePayment(current, expenseId, id, payment), expected);
          details(expenseId);
          flash('تم حفظ الدفعة وتحديث الرصيد.');
          break;
        }
        case 'delete':
          await commit(current => Finance.removeExpense(current, id), expected);
          dialog.close();
          flash('تم حذف المصروف.');
          break;
        case 'cancel':
          await commit(current => Finance.cancel(current, id, textValue(data, 'reason')), expected);
          preview(id);
          flash('تم إلغاء السند. يمكنك تعديل الدفعة وإصدار سند بديل.');
          break;
        case 'settings': {
          const file = data.get('logo');
          const logo = file?.size ? await readLogo(file) : data.has('removeLogo') ? '' : state.settings.logo;
          await commit(current => { current.settings = { name: textValue(data, 'name'), english: textValue(data, 'english'),
            contact: textValue(data, 'contact'), logo }; }, expected);
          dialog.close();
          flash('تم حفظ إعدادات المؤسسة.');
          break;
        }
        case 'category':
          await commit(current => Finance.saveCategory(current, id, textValue(data, 'name')), expected);
          dialog.close();
          flash('تم حفظ التصنيف.');
          break;
        case 'import': {
          const backup = pendingBackup;
          await commit(current => {
            const counters = Object.fromEntries(Object.entries(current.counters).map(([key, value]) =>
              [key, Math.max(value, backup.counters[key])]));
            Object.assign(current, backup, { counters, revision: current.revision });
          }, expected);
          pendingBackup = null;
          Object.assign(criteria, { search: '', category: '', status: '' });
          Object.assign(reportCriteria, { from: '', to: '', category: '', vendor: '', status: '' });
          page = 0;
          voucherFilter = '';
          dialog.close();
          render();
          flash('تمت استعادة النسخة الاحتياطية.');
          break;
        }
      }
    } catch (error) {
      showError(form, error);
    } finally {
      busy = false;
      submit.disabled = false;
    }
  }
  const handlers = {
    close: () => dialog.close(),
    'expense-new': () => expenseForm(0),
    'expense-edit': expenseForm,
    'expense-delete': confirmDelete,
    details,
    sort: (_, key) => {
      sort = { key, ascending: sort.key === key ? !sort.ascending : true };
      page = 0;
      renderExpenses();
      content.querySelector(`[data-action="sort"][data-id="${key}"]`)?.focus();
    },
    page: increment => {
      page += increment;
      renderExpenses();
      content.querySelector(`[data-action="page"][data-id="${increment}"]:not(:disabled)`)?.focus();
    },
    'line-add': () => {
      const lines = dialog.querySelector('#expense-lines');
      lines.insertAdjacentHTML('beforeend', itemLine());
      updateItemTotal();
      lines.lastElementChild.querySelector('input').focus();
    },
    'line-remove': (_, __, control) => {
      control.closest('.item-line').remove();
      updateItemTotal();
      dialog.querySelector('[data-action="line-add"]').focus();
    },
    'payment-new': id => paymentForm(id, 0),
    'payment-edit': id => paymentForm(Finance.get(state.payments, id).expenseId, id),
    'voucher-preview': preview,
    'voucher-cancel': cancelForm,
    'voucher-issue': async id => {
      busy = true;
      try {
        const voucherId = await commit(current => Finance.issue(current, id));
        preview(voucherId);
        flash('تم إصدار سند الصرف.');
      } finally {
        busy = false;
      }
    },
    print: id => {
      printArea.innerHTML = Vouchers.document(Finance.get(state.vouchers, id));
      window.print();
    },
    pdf: id => handlers.print(id),
    'report-export': () => Reports.exportExpenses(reportItems(), true),
    'expense-export': () => Reports.exportExpenses(expenseRows),
    'ledger-export': async () => {
      const latest = await Database.read();
      Utils.download('ledger.js', 'globalThis.publishedLedger = ' + JSON.stringify(latest, null, 2) + ';\n', 'text/javascript;charset=utf-8');
      flash('تم تجهيز ملف السجل. عند نشر الملف تصبح بياناته متاحة لمن يصل إلى الموقع.');
    },
    'backup-export': async () => {
      const latest = await Database.read();
      Utils.download(`house-of-antiques-backup-${Utils.today()}.json`, JSON.stringify(latest, null, 2), 'application/json;charset=utf-8');
      flash('تم تجهيز النسخة الاحتياطية للتنزيل.');
    },
    'backup-choose': () => document.querySelector('#import-file').click(),
    'settings-edit': settingsForm,
    'category-edit': id => {
      const name = id ? Finance.get(state.categories, id).name : '';
      showModal(id ? 'تعديل التصنيف' : 'تصنيف جديد', field('اسم التصنيف', input('name', name, 'maxlength="100" required')),
        { form: 'category', id, submit: 'حفظ التصنيف' });
    }
  };
  document.addEventListener('click', async event => {
    const control = event.target.closest('[data-action]');
    if (!control || !state || busy) return;
    const { action, id } = control.dataset;
    try {
      if (action.startsWith('nav-')) {
        view = action.slice(4);
        if (!published) state = await Database.read();
        render();
        content.focus({ preventScroll: true });
        return;
      }
      await handlers[action]?.(Number(id), id, control);
    } catch (error) {
      flash(error.message || 'تعذّر إكمال العملية.', true);
    }
  });
  document.addEventListener('input', event => {
    const { target } = event;
    if (target.name === 'line-amount') updateItemTotal();
    if (target.dataset.filter) {
      criteria[target.dataset.filter] = target.value;
      page = 0;
      renderExpenses();
    }
    if (target.dataset.report) {
      reportCriteria[target.dataset.report] = target.value;
      renderReport();
    }
  });
  document.addEventListener('change', event => {
    const { target } = event;
    if (target.id === 'voucher-filter') {
      voucherFilter = target.value;
      render();
      document.querySelector('#voucher-filter')?.focus();
    }
    if (target.id === 'import-file') {
      void chooseBackup(target.files[0]);
      target.value = '';
    }
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (!dialog.open) pendingBackup = null; });
  document.addEventListener('submit', submitForm);
  window.addEventListener('afterprint', () => { printArea.replaceChildren(); });
  document.querySelector('#today').innerHTML = `${icon('calendar')}<span>${e(Utils.longDate.format(new Date()))}</span>`;
  async function start() {
    try {
      if (published) {
        document.querySelector('#storage-mode').textContent = 'السجل المنشور';
        state = globalThis.publishedLedger === null ? Finance.initial() : Finance.validate(globalThis.publishedLedger);
      } else {
        await Database.open();
        state = await Database.read();
      }
      render();
    } catch {
      content.setAttribute('aria-busy', 'false');
      content.innerHTML = published
        ? '<p class="warning" role="alert">تعذّر تحميل ملف السجل المنشور. تحقّق من وجود data/ledger.js وصحة محتواه.</p>'
        : '<p class="warning" role="alert">تعذّر فتح قاعدة البيانات المحلية. جرّب فتح الملف في نافذة عادية لمتصفح يدعم IndexedDB، وتأكد من إتاحة التخزين المحلي.</p>';
    }
  }
  void start();
})();
