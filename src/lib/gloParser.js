import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const THAI_MONTHS = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// PDF text extraction returns runs in the document's internal content-
// stream order, which for table layouts is often NOT visual reading
// order — Thai GLO result slips are a good example of this. We instead
// reconstruct rows using each run's actual (x, y) position on the page,
// then read left-to-right within each row and top-to-bottom across rows,
// which reliably matches what a person sees when looking at the PDF.
async function extractPdfTextByPosition(file) {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter((it) => it.str.trim().length > 0);

    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    const TOL = 3;
    for (const it of items) {
      let row = rows.find((r) => Math.abs(r.y - it.y) <= TOL);
      if (!row) {
        row = { y: it.y, items: [] };
        rows.push(row);
      }
      row.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      fullText += row.items.map((i) => i.str).join(" ") + "\n";
    }
  }
  return fullText;
}

function parseGloDate(text) {
  const m = text.match(/งวดวันที่\s*(\d{1,2})\s*([ก-๙]+)\s*(\d{4})/);
  if (!m) throw new Error("Couldn't find the draw date on this PDF.");
  const day = parseInt(m[1], 10);
  const month = THAI_MONTHS[m[2]];
  if (!month) throw new Error(`Unrecognized Thai month name: "${m[2]}".`);
  const gregorianYear = parseInt(m[3], 10) - 543; // Buddhist calendar -> Gregorian
  const iso = `${gregorianYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = `${day} ${MONTH_NAMES[month - 1]} ${gregorianYear}`;
  return { iso, label };
}

// Parses the 6-digit (L6) game results only — the 3-digit game section
// further down the slip isn't part of this app's ticket system.
export async function parseGloPdf(file) {
  const rawText = await extractPdfTextByPosition(file);
  const { iso, label } = parseGloDate(rawText);

  // GLO visually spaces out the "near first prize" numbers digit by
  // digit on the printed slip (e.g. "4 1 7 2 1 1") — collapse those
  // back into normal 6-digit numbers before extracting.
  const text = rawText.replace(/\b(\d)\s(\d)\s(\d)\s(\d)\s(\d)\s(\d)\b/g, "$1$2$3$4$5$6");

  const l6Start = text.indexOf("ผลการออกรางวัลสลากกินแบ่งรัฐบาลหกหลัก");
  const l6End = text.indexOf("ผลการออกรางวัลสลากกินแบ่งรัฐบาลตัวเลขสามหลัก");
  if (l6Start === -1 || l6End === -1) {
    throw new Error("This doesn't look like a GLO 6-digit (L6) results PDF.");
  }
  const section = text.slice(l6Start, l6End);

  const rowMatch = section.match(/(\d{6})\s+(\d{3})\s+(\d{3})\s+(\d{3})\s+(\d{3})\s+(\d{2})\b/);
  if (!rowMatch) throw new Error("Couldn't find the first-prize row on this PDF.");
  const [, first, frontA, frontB, lastA, lastB, last2] = rowMatch;

  const rest = section.slice(rowMatch.index + rowMatch[0].length);
  const sixDigitNumbers = [...rest.matchAll(/\b\d{6}\b/g)].map((m) => m[0]);

  const EXPECTED = { near: 2, second: 5, third: 10, fourth: 50, fifth: 100 };
  const totalExpected = Object.values(EXPECTED).reduce((a, b) => a + b, 0);
  if (sixDigitNumbers.length !== totalExpected) {
    throw new Error(
      `Expected ${totalExpected} numbers after the first-prize row but found ${sixDigitNumbers.length}. ` +
        `This PDF's layout may not match what this parser expects — please check it or enter the draw manually.`
    );
  }

  let i = 0;
  const take = (n) => sixDigitNumbers.slice(i, (i += n));
  const near = take(EXPECTED.near);
  const second = take(EXPECTED.second);
  const third = take(EXPECTED.third);
  const fourth = take(EXPECTED.fourth);
  const fifth = take(EXPECTED.fifth);

  const tiers = [
    { label: "First prize", prize: "6,000,000", numbers: [first] },
    { label: "Front 3 digits", prize: "4,000", numbers: [frontA, frontB] },
    { label: "Last 3 digits", prize: "4,000", numbers: [lastA, lastB] },
    { label: "Last 2 digits", prize: "2,000", numbers: [last2] },
    { label: "Near first prize", prize: "100,000", numbers: near },
    { label: "Second prize", prize: "200,000", numbers: second },
    { label: "Third prize", prize: "80,000", numbers: third },
    { label: "Fourth prize", prize: "40,000", numbers: fourth },
    { label: "Fifth prize", prize: "20,000", numbers: fifth },
  ];

  return { drawDateIso: iso, label, tiers };
}
