const Database = (() => {
  let connection;
  function open() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('التخزين المحلي غير متاح في هذا المتصفح.'));
      const request = indexedDB.open('house-of-antiques-expenses', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('ledger');
      request.onsuccess = () => {
        connection = request.result;
        connection.onversionchange = () => connection.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('أغلق النوافذ الأخرى التي تستخدم النظام ثم أعد فتحه.'));
    });
  }
  function transaction(change) {
    return new Promise((resolve, reject) => {
      const tx = connection.transaction('ledger', change ? 'readwrite' : 'readonly');
      const store = tx.objectStore('ledger');
      const request = store.get('state');
      let result;
      let failure;
      request.onsuccess = () => {
        try {
          const state = request.result ?? Finance.initial();
          if (change) {
            result = change(state);
            Finance.validate(state);
            store.put(state, 'state');
          } else {
            result = state;
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('تعذّر حفظ البيانات محلياً.'));
    });
  }
  return { open, read: () => transaction(), change: transaction };
})();
