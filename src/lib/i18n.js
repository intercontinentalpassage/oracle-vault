import { useEffect, useState } from "react";
import { ensureTranslationsLoaded, getOverride, isKeyLocked, subscribe } from "./translationsStore";

const LANG_KEY = "oracle-vault:lang";

export const I18N = {
  en: {
    yourDigits: "Your digits",
    clear: "Clear",
    anywhereInNumber: "Anywhere in number",
    availableTickets: "Available tickets",
    filterAll: "All",
    filterSingle: "Single",
    filterPair: "Pair",
    filterSet: "Set of 5",
    badgePair: "Pair ×2",
    badgeSet: "Set ×5",
    inStock: "In stock",
    added: "Added",
    add: "Add",
    noTicketsMatch: "No tickets match those digits",
    tryFewerDigits: "Try fewer digits, or allow matches anywhere.",
    clearSearch: "Clear search",
    winningNumbersFull: "This month's winning numbers · {label} · First prize {prize}",
    noDrawPublished: "No draw results published yet.",
    hideAllPrizes: "Hide all prizes",
    showAllPrizes: "Show all prizes",
    yourCart: "Your cart",
    removeAll: "Remove all",
    closeCart: "Close cart",
    requestSent: "Request sent",
    requestSentDetailCustomer: "Check \"My tickets\" with the phone number you used to see when it's approved.",
    ticketsCountTotal: "{count} ticket(s) · {currency}{total} total. These tickets are on hold while it's reviewed.",
    done: "Done",
    cartEmpty: "Your cart is empty.",
    remove: "Remove",
    total: "Total",
    placeholderPhone: "Your phone number",
    placeholderName: "Name (optional)",
    enterValidPhone: "Enter a valid phone number.",
    sending: "Sending…",
    requestPurchase: "Request purchase",
    myTickets: "My tickets",
    cartCount: "Cart · {n}",
    nextDraw: "Next draw · {date}",
    searchTicketsHeading: "Search {n} tickets by any digit.",
    searchTicketsSub: "Fill only the boxes you care about. Matching tickets appear instantly, grouped by prize.",
    footerNotice: "Results published by the Government Lottery Office. Buyers must be 20 or older.",
    login: "Login",
    backToTop: "Back to top",
    couldntLoadStorefront: "Couldn't load the storefront",
    loadingTickets: "Loading tickets…",
    shopPossessive: "{name}'s Shop",
    viaOracleVault: "via Oracle Vault",
    mainStorefront: "Main storefront",
    couldntLoadShop: "Couldn't load this shop",
    shopInactive: "This shop doesn't exist or is no longer active.",
    goToMainStorefront: "Go to the main storefront",
    backToStorefront: "← Back to storefront",
    lookUpPurchases: "Look up your purchases with the phone number you used at checkout.",
    placeholderPhoneNumber: "Phone number",
    lookingUp: "Looking up…",
    lookUp: "Look up",
    noPurchasesFound: "No purchases found for that number.",
    statusPurchased: "Purchased",
    statusPending: "Request pending review",
    statusRejected: "Request declined",
    noWinYet: "No win yet",
  },
  my: {
    yourDigits: "သင့်ဂဏန်းများ",
    clear: "ရှင်းမည်",
    anywhereInNumber: "ဂဏန်းတစ်နေရာရာတွင်",
    availableTickets: "ရရှိနိုင်သောလက်မှတ်များ",
    filterAll: "အားလုံး",
    filterSingle: "တစ်လုံးထီ",
    filterPair: "နှစ်လုံးထီ",
    filterSet: "ငါးလုံးတွဲ",
    badgePair: "နှစ်လုံးထီ ×2",
    badgeSet: "ငါးလုံးတွဲ ×5",
    inStock: "ရနိုင်သည်",
    added: "ထည့်ပြီး",
    add: "ထည့်မည်",
    noTicketsMatch: "ဤဂဏန်းများနှင့်ကိုက်ညီသောလက်မှတ်မရှိပါ",
    tryFewerDigits: "ဂဏန်းအရေအတွက်လျှော့ထည့်ကြည့်ပါ သို့မဟုတ် နေရာမရွေးဖြစ်စေခွင့်ပြုပါ။",
    clearSearch: "ရှာဖွေမှုရှင်းမည်",
    winningNumbersFull: "ဤလအတွက် ထွက်ဂဏန်းများ · {label} · ပထမဆု {prize}",
    noDrawPublished: "ဤလအတွက် ရလဒ်များမထုတ်ပြန်ရသေးပါ။",
    hideAllPrizes: "ဆုအားလုံးဖျောက်မည်",
    showAllPrizes: "ဆုအားလုံးပြမည်",
    yourCart: "သင့်ဈေးခြင်းတောင်း",
    removeAll: "အားလုံးဖယ်ရှားမည်",
    closeCart: "ဈေးခြင်းတောင်းပိတ်မည်",
    requestSent: "တောင်းဆိုချက်ပို့ပြီးပါပြီ",
    requestSentDetailCustomer: "အတည်ပြုပြီးမပြီးသိရန် ဝယ်ယူစဉ်အသုံးပြုခဲ့သောဖုန်းနံပါတ်ဖြင့် \"My tickets\" တွင်စစ်ဆေးပါ။",
    ticketsCountTotal: "လက်မှတ် {count} စောင် · စုစုပေါင်း {currency}{total} — ဤလက်မှတ်များကို စိစစ်နေစဉ် ယာယီဖယ်ထားပါသည်။",
    done: "ပြီးပါပြီ",
    cartEmpty: "သင့်ဈေးခြင်းတောင်းထဲတွင် ဘာမှမရှိသေးပါ။",
    remove: "ဖယ်ရှားမည်",
    total: "စုစုပေါင်း",
    placeholderPhone: "သင့်ဖုန်းနံပါတ်",
    placeholderName: "အမည် (မဖြည့်လည်းရ)",
    enterValidPhone: "မှန်ကန်သောဖုန်းနံပါတ်ထည့်ပါ။",
    sending: "ပို့နေသည်…",
    requestPurchase: "ဝယ်ယူမှုတောင်းဆိုမည်",
    myTickets: "ကျွန်ုပ်၏လက်မှတ်များ",
    cartCount: "ဈေးခြင်းတောင်း · {n}",
    nextDraw: "နောက်ထီပေါက်မည့်ရက် · {date}",
    searchTicketsHeading: "ဂဏန်းတစ်လုံးလုံးဖြင့် လက်မှတ် {n} စောင်ကိုရှာပါ။",
    searchTicketsSub: "စိတ်ဝင်စားသည့်ကွက်လပ်များကိုသာဖြည့်ပါ။ ကိုက်ညီသောလက်မှတ်များကို ဆုအလိုက်စုပြီးချက်ချင်းပြပါမည်။",
    footerNotice: "ရလဒ်များကို အစိုးရထီရုံးမှထုတ်ပြန်သည်။ ဝယ်ယူသူများသည် အသက် ၂၀ နှင့်အထက်ဖြစ်ရမည်။",
    login: "လော့ဂ်အင်",
    backToTop: "အပေါ်သို့ပြန်သွားမည်",
    couldntLoadStorefront: "စတိုးဆိုင်ကိုမဖွင့်နိုင်ပါ",
    loadingTickets: "လက်မှတ်များဖွင့်နေသည်…",
    shopPossessive: "{name} ၏ ဆိုင်",
    viaOracleVault: "Oracle Vault မှတဆင့်",
    mainStorefront: "ပင်မစတိုးဆိုင်",
    couldntLoadShop: "ဤဆိုင်ကိုမဖွင့်နိုင်ပါ",
    shopInactive: "ဤဆိုင်မရှိတော့ပါ သို့မဟုတ် ရပ်ဆိုင်းထားပါသည်။",
    goToMainStorefront: "ပင်မစတိုးဆိုင်သို့သွားမည်",
    backToStorefront: "← စတိုးဆိုင်သို့ပြန်သွားမည်",
    lookUpPurchases: "ငွေချေစဉ်အသုံးပြုခဲ့သောဖုန်းနံပါတ်ဖြင့် သင့်ဝယ်ယူမှုများကိုရှာပါ။",
    placeholderPhoneNumber: "ဖုန်းနံပါတ်",
    lookingUp: "ရှာနေသည်…",
    lookUp: "ရှာမည်",
    noPurchasesFound: "ထိုနံပါတ်အတွက်ဝယ်ယူမှုမတွေ့ပါ။",
    statusPurchased: "ဝယ်ယူပြီး",
    statusPending: "စိစစ်နေဆဲ",
    statusRejected: "ငြင်းပယ်ခံရ",
    noWinYet: "မထွက်သေးပါ",
  },
  th: {
    yourDigits: "ตัวเลขของคุณ",
    clear: "ล้าง",
    anywhereInNumber: "อยู่ตำแหน่งใดก็ได้ในเลข",
    availableTickets: "สลากที่มีจำหน่าย",
    filterAll: "ทั้งหมด",
    filterSingle: "เลขเดี่ยว",
    filterPair: "เลขคู่",
    filterSet: "ชุด 5 ใบ",
    badgePair: "คู่ ×2",
    badgeSet: "ชุด ×5",
    inStock: "มีสินค้า",
    added: "เพิ่มแล้ว",
    add: "เพิ่ม",
    noTicketsMatch: "ไม่พบสลากที่ตรงกับตัวเลขนี้",
    tryFewerDigits: "ลองใส่ตัวเลขให้น้อยลง หรือเลือกให้ตรงตำแหน่งใดก็ได้",
    clearSearch: "ล้างการค้นหา",
    winningNumbersFull: "เลขที่ออกเดือนนี้ · {label} · รางวัลที่ 1 {prize}",
    noDrawPublished: "ยังไม่ประกาศผลรางวัลสำหรับงวดนี้",
    hideAllPrizes: "ซ่อนรางวัลทั้งหมด",
    showAllPrizes: "แสดงรางวัลทั้งหมด",
    yourCart: "ตะกร้าของคุณ",
    removeAll: "ลบทั้งหมด",
    closeCart: "ปิดตะกร้า",
    requestSent: "ส่งคำขอแล้ว",
    requestSentDetailCustomer: "ตรวจสอบสถานะได้ที่ \"My tickets\" ด้วยหมายเลขโทรศัพท์ที่ใช้ซื้อ",
    ticketsCountTotal: "สลาก {count} ใบ · รวม {currency}{total} — สลากเหล่านี้ถูกกันไว้ระหว่างตรวจสอบ",
    done: "เสร็จสิ้น",
    cartEmpty: "ตะกร้าของคุณว่างเปล่า",
    remove: "ลบ",
    total: "ยอดรวม",
    placeholderPhone: "หมายเลขโทรศัพท์ของคุณ",
    placeholderName: "ชื่อ (ไม่บังคับ)",
    enterValidPhone: "กรุณากรอกหมายเลขโทรศัพท์ที่ถูกต้อง",
    sending: "กำลังส่ง…",
    requestPurchase: "ขอซื้อ",
    myTickets: "สลากของฉัน",
    cartCount: "ตะกร้า · {n}",
    nextDraw: "งวดถัดไป · {date}",
    searchTicketsHeading: "ค้นหาสลาก {n} ใบด้วยตัวเลขใดก็ได้",
    searchTicketsSub: "กรอกเฉพาะช่องที่คุณสนใจ สลากที่ตรงกันจะแสดงทันที จัดกลุ่มตามรางวัล",
    footerNotice: "ผลรางวัลประกาศโดยสำนักงานสลากกินแบ่งรัฐบาล ผู้ซื้อต้องมีอายุ 20 ปีขึ้นไป",
    login: "เข้าสู่ระบบ",
    backToTop: "กลับขึ้นด้านบน",
    couldntLoadStorefront: "ไม่สามารถโหลดหน้าร้านได้",
    loadingTickets: "กำลังโหลดสลาก…",
    shopPossessive: "ร้านของ {name}",
    viaOracleVault: "ผ่าน Oracle Vault",
    mainStorefront: "หน้าร้านหลัก",
    couldntLoadShop: "ไม่สามารถโหลดร้านนี้ได้",
    shopInactive: "ร้านนี้ไม่มีอยู่หรือปิดใช้งานแล้ว",
    goToMainStorefront: "ไปที่หน้าร้านหลัก",
    backToStorefront: "← กลับไปหน้าร้าน",
    lookUpPurchases: "ค้นหาประวัติการซื้อด้วยหมายเลขโทรศัพท์ที่ใช้ตอนชำระเงิน",
    placeholderPhoneNumber: "หมายเลขโทรศัพท์",
    lookingUp: "กำลังค้นหา…",
    lookUp: "ค้นหา",
    noPurchasesFound: "ไม่พบการซื้อสำหรับหมายเลขนี้",
    statusPurchased: "ซื้อแล้ว",
    statusPending: "รอตรวจสอบคำขอ",
    statusRejected: "คำขอถูกปฏิเสธ",
    noWinYet: "ยังไม่ถูกรางวัล",
  },
};

export function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || "en";
  } catch {
    return "en";
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore — storage may be blocked; state still updates in-memory
  }
}

export function t(lang, key, vars) {
  // A locked key ignores the selected language and always shows the
  // English text — used for things like a brand name that shouldn't
  // change no matter what a customer picks.
  const effectiveLang = isKeyLocked(key) ? "en" : lang;
  let str = getOverride(effectiveLang, key) || (I18N[effectiveLang] && I18N[effectiveLang][key]) || I18N.en[key] || key;
  if (vars) {
    for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
  }
  return str;
}

// Hook: returns [lang, setLangAndPersist]. Also applies the Myanmar font
// to <body> whenever Myanmar is selected, keeps the <html lang> attr in
// sync for accessibility, and loads any admin-edited translation text
// from the database (once per app load, shared across all components).
export function useLang() {
  const [lang, setLangState] = useState(getLang);
  const [, forceRender] = useState(0);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.body.style.fontFamily =
      lang === "my"
        ? "'Noto Sans Myanmar', Sora, system-ui, sans-serif"
        : "Sora, system-ui, sans-serif";
  }, [lang]);

  useEffect(() => {
    const unsubscribe = subscribe(() => forceRender((n) => n + 1));
    ensureTranslationsLoaded();
    return unsubscribe;
  }, []);

  function changeLang(next) {
    setLang(next);
    setLangState(next);
  }

  return [lang, changeLang];
}
