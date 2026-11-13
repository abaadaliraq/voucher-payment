const Finance = (() => {
  const categories = [
    'الحديقة والتشجير', 'الكهرباء والإنارة', 'الماء والسباكة', 'أعمال الجبس بورد',
    'الصيانة والترميم', 'العطور والمعطرات', 'مواد التنظيف', 'الأثاث والمقتنيات',
    'الضيافة', 'أجور العمال', 'مصروفات أخرى'
  ];
  const statuses = { unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً', paid: 'مدفوع بالكامل' };
  const methods = { cash: 'نقداً', transfer: 'تحويل مصرفي' };
  const keys = ['category', 'expense', 'payment', 'voucher'];
  const initial = () => ({
    version: 1, revision: 0, counters: { category: categories.length, expense: 0, payment: 0, voucher: 0 },
    settings: { name: 'بيت التحفيات', english: 'HOUSE OF ANTIQUES', contact: '', logo: '' },
    categories: categories.map((name, index) => ({ id: index + 1, name })),
    expenses: [], payments: [], vouchers: []
  });
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
  const string = (value, max) => typeof value === 'string' && value.length <= max;
  const required = (value, max) => string(value, max) && value.trim().length > 0;
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const logo = value => value === '' || (string(value, 400_000) && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
  const validSettings = value => record(value) && required(value.name, 100) && required(value.english, 100)
    && string(value.contact, 250) && logo(value.logo);
  const validMethod = value => Object.hasOwn(methods, value);
  const lookup = (items, id) => items.find(item => item.id === id);
  function get(items, id) {
    const item = lookup(items, id);
    if (!item) throw new Error('تعذّر العثور على السجل المطلوب.');
    return item;
  }
  const categoryName = (state, id) => lookup(state.categories, id)?.name ?? '';
  const paymentsFor = (state, id) => state.payments.filter(payment => payment.expenseId === id).sort((a, b) => a.id - b.id);
  const activeVoucher = (state, id) => state.vouchers.find(voucher => voucher.paymentId === id && !voucher.cancelled);
  function totals(total, paid) {
    return { total, paid, remaining: total - paid, status: paid === 0 ? 'unpaid' : paid === total ? 'paid' : 'partial' };
  }
  function rows(state) {
    const paidByExpense = new Map();
    const names = new Map(state.categories.map(item => [item.id, item.name]));
    for (const payment of state.payments) {
      paidByExpense.set(payment.expenseId, Utils.sum([paidByExpense.get(payment.expenseId) ?? 0, payment.amount]));
    }
    return state.expenses.map(expense => ({
      ...expense, category: names.get(expense.categoryId), ...totals(expense.total, paidByExpense.get(expense.id) ?? 0)
    }));
  }
  function summary(items) {
    return totals(Utils.sum(items.map(item => item.total)), Utils.sum(items.map(item => item.paid)));
  }
  function validSnapshot(item) {
    return record(item) && positive(item.expenseId) && Utils.validDate(item.date) && validMethod(item.method)
      && required(item.recipient, 150) && required(item.category, 100) && required(item.description, 500)
      && string(item.notes, 1000) && validSettings(item.settings) && positive(item.total) && positive(item.amount)
      && nonnegative(item.previous) && positive(item.paid) && nonnegative(item.remaining)
      && item.paid - item.amount === item.previous && item.total - item.paid === item.remaining;
  }
  function validate(state) {
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    check(record(state) && Object.keys(state).length === 8
      && state.version === 1 && nonnegative(state.revision) && record(state.counters)
      && Object.keys(state.counters).length === keys.length
      && keys.every(key => nonnegative(state.counters[key])) && validSettings(state.settings), 'بنية قاعدة البيانات أو إعداداتها غير صالحة.');
    const lists = [state.categories, state.expenses, state.payments, state.vouchers];
    const indexes = lists.map((list, index) => {
      check(Array.isArray(list), 'إحدى قوائم البيانات مفقودة.');
      const ids = new Map();
      for (const item of list) {
        check(record(item) && positive(item.id) && item.id <= state.counters[keys[index]] && !ids.has(item.id),
          'توجد أرقام سجلات مكررة أو غير صالحة.');
        ids.set(item.id, item);
      }
      return ids;
    });
    const [categoryIds, expenseIds, paymentIds] = indexes;
    check(state.categories.length > 0 && state.categories.every(item => required(item.name, 100))
      && new Set(state.categories.map(item => item.name.trim())).size === state.categories.length, 'التصنيفات غير صالحة أو مكررة.');
    for (const item of state.expenses) {
      check(Utils.validDate(item.date) && categoryIds.has(item.categoryId) && required(item.description, 500)
        && required(item.vendor, 150) && positive(item.total) && Array.isArray(item.items), 'توجد بيانات مصروف ناقصة أو غير صالحة.');
      check(item.items.every(line => record(line) && required(line.name, 150) && positive(line.amount))
        && (!item.items.length || Utils.sum(item.items.map(line => line.amount)) === item.total), 'مجموع البنود غير مطابق لإجمالي المصروف.');
    }
    const paid = new Map();
    for (const item of state.payments) {
      check(expenseIds.has(item.expenseId) && Utils.validDate(item.date) && positive(item.amount)
        && validMethod(item.method) && required(item.recipient, 150) && string(item.notes, 1000), 'توجد دفعة غير صالحة أو بلا مصروف مرتبط.');
      const next = Utils.sum([paid.get(item.expenseId) ?? 0, item.amount]);
      check(next <= expenseIds.get(item.expenseId).total, 'مجموع الدفعات يتجاوز إجمالي المصروف.');
      paid.set(item.expenseId, next);
    }
    const issued = new Set();
    for (const item of state.vouchers) {
      check(positive(item.paymentId) && item.paymentId <= state.counters.payment && Utils.validDate(item.issued)
        && validSnapshot(item.snapshot) && item.snapshot.expenseId <= state.counters.expense
        && (item.cancelled === null || (record(item.cancelled) && Utils.validDate(item.cancelled.date)
          && required(item.cancelled.reason, 300))), 'توجد بيانات سند صرف غير صالحة.');
      if (item.cancelled) continue;
      const payment = paymentIds.get(item.paymentId);
      check(payment && !issued.has(item.paymentId)
        && ['expenseId', 'date', 'recipient', 'amount', 'method', 'notes'].every(key => payment[key] === item.snapshot[key]),
      'يوجد سند فعّال غير مطابق لدفعة مسجلة أو يوجد أكثر من سند فعّال للدفعة.');
      issued.add(item.paymentId);
    }
    Utils.sum(state.expenses.map(item => item.total));
    return state;
  }
  function saveExpense(state, id, data) {
    const expense = id ? get(state.expenses, id) : { id: ++state.counters.expense };
    const paid = Utils.sum(paymentsFor(state, expense.id).map(payment => payment.amount));
    if (data.total < paid) throw new Error('إجمالي المصروف لا يمكن أن يقلّ عن مجموع الدفعات المسجلة.');
    Object.assign(expense, data);
    if (!id) state.expenses.push(expense);
    return expense.id;
  }
  function savePayment(state, expenseId, id, data) {
    const expense = get(state.expenses, expenseId);
    const payment = id ? get(state.payments, id) : { id: ++state.counters.payment, expenseId };
    if (payment.expenseId !== expenseId) throw new Error('الدفعة غير مرتبطة بهذا المصروف.');
    if (activeVoucher(state, payment.id)) throw new Error('ألغِ سند الصرف الفعّال قبل تعديل الدفعة.');
    const other = Utils.sum(paymentsFor(state, expenseId).filter(item => item.id !== id).map(item => item.amount));
    if (data.amount > expense.total - other) throw new Error('قيمة الدفعة تتجاوز المبلغ المتبقي المتاح.');
    Object.assign(payment, data);
    if (!id) state.payments.push(payment);
    return payment.id;
  }
  function issue(state, paymentId) {
    const payment = get(state.payments, paymentId);
    const current = activeVoucher(state, paymentId);
    if (current) return current.id;
    const expense = get(state.expenses, payment.expenseId);
    const previous = Utils.sum(paymentsFor(state, expense.id).filter(item => item.id < paymentId).map(item => item.amount));
    const paid = Utils.sum([previous, payment.amount]);
    const id = ++state.counters.voucher;
    state.vouchers.push({
      id, paymentId, issued: Utils.today(), cancelled: null,
      snapshot: {
        expenseId: expense.id, date: payment.date, recipient: payment.recipient, category: categoryName(state, expense.categoryId),
        description: expense.description, total: expense.total, amount: payment.amount, previous, paid,
        remaining: expense.total - paid, method: payment.method, notes: payment.notes, settings: { ...state.settings }
      }
    });
    return id;
  }
  function cancel(state, id, reason) {
    const voucher = get(state.vouchers, id);
    if (voucher.cancelled) throw new Error('السند ملغى بالفعل.');
    voucher.cancelled = { date: Utils.today(), reason };
  }
  function removeExpense(state, id) {
    get(state.expenses, id);
    for (const voucher of state.vouchers) {
      if (voucher.snapshot.expenseId === id && !voucher.cancelled) cancel(state, voucher.id, 'حذف المصروف المرتبط بالسند.');
    }
    state.payments = state.payments.filter(item => item.expenseId !== id);
    state.expenses = state.expenses.filter(item => item.id !== id);
  }
  function saveCategory(state, id, name) {
    if (state.categories.some(item => item.name === name && item.id !== id)) throw new Error('اسم التصنيف مستخدم بالفعل.');
    if (id) get(state.categories, id).name = name;
    else state.categories.push({ id: ++state.counters.category, name });
  }
  return { initial, validate, statuses, methods, get, categoryName, paymentsFor, activeVoucher, rows, summary,
    saveExpense, savePayment, issue, cancel, removeExpense, saveCategory };
})();
