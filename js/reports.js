const Reports = (() => {
  function filter(items, criteria) {
    const search = Utils.digits(criteria.search || '').trim().toLocaleLowerCase('ar');
    return items.filter(item =>
      (!criteria.category || item.categoryId === Number(criteria.category))
      && (!criteria.status || item.status === criteria.status)
      && (!criteria.vendor || item.vendor === criteria.vendor)
      && (!criteria.from || item.date >= criteria.from)
      && (!criteria.to || item.date <= criteria.to)
      && (!search || [item.date, item.category, item.description, item.vendor, Utils.idLabel('EX', item.id)]
        .some(value => Utils.digits(value).toLocaleLowerCase('ar').includes(search))));
  }
  function group(items, key) {
    const groups = new Map();
    for (const item of items) {
      const name = key(item);
      const totals = groups.get(name) || { name, total: 0, paid: 0, remaining: 0, count: 0 };
      totals.total += item.total;
      totals.paid += item.paid;
      totals.remaining += item.remaining;
      totals.count++;
      groups.set(name, totals);
    }
    return [...groups.values()];
  }
  function breakdown(items) {
    const byTotal = (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar');
    return [
      { title: 'حسب التصنيف', rows: group(items, item => item.category).sort(byTotal) },
      { title: 'حسب المورد', rows: group(items, item => item.vendor).sort(byTotal) },
      { title: 'حسب الشهر', rows: group(items, item => item.date.slice(0, 7)).sort((a, b) => b.name.localeCompare(a.name)) }
    ];
  }
  const headers = ['رقم المصروف', 'تاريخ التسجيل', 'التصنيف', 'البيان', 'الجهة / المورد',
    'الإجمالي (IQD)', 'المدفوع (IQD)', 'المتبقي (IQD)', 'الحالة'];
  const csvRows = items => items.map(item => [Utils.idLabel('EX', item.id), item.date, item.category, item.description,
    item.vendor, item.total, item.paid, item.remaining, Finance.statuses[item.status]]);
  function exportExpenses(items, report = false) {
    const totals = Finance.summary(items);
    const rows = [headers, ...csvRows(items), ['المجموع', '', '', '', '', totals.total, totals.paid, totals.remaining, '']];
    if (report) {
      for (const section of breakdown(items)) {
        rows.push([], [section.title, 'عدد المصروفات', 'الإجمالي (IQD)', 'المدفوع (IQD)', 'المتبقي (IQD)']);
        rows.push(...section.rows.map(item => [item.name, item.count, item.total, item.paid, item.remaining]));
      }
      rows.push([], ['المصروفات غير المسددة بالكامل'], headers, ...csvRows(items.filter(item => item.remaining > 0)));
    }
    Utils.csv(rows, `${report ? 'financial-report' : 'expenses'}-${Utils.today()}.csv`);
  }
  return { filter, breakdown, exportExpenses };
})();
