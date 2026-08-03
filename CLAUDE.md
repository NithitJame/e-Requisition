# Frontend Project Standards (CLAUDE.md)

> **Standard version: 1.0.0** — อัปเดตล่าสุด 2026-07-24
> เมื่อแก้ไขมาตรฐาน ให้เพิ่มเลขเวอร์ชันและวันที่ทุกครั้ง เวลาก็อปไฟล์นี้ไปโปรเจกต์ใหม่จะได้รู้ว่า repo นั้นยึดมาตรฐานเวอร์ชันไหน (ตรวจง่าย ๆ ว่า repo ไหนตกรุ่น)

> **ไฟล์นี้คือ single source of truth ของมาตรฐาน Frontend ทั้งบริษัท** — เป็นแหล่งอ้างอิงหลักเพียงหนึ่งเดียว หากมีข้อขัดแย้งกับเอกสาร/ความเห็นอื่น ให้ยึดไฟล์นี้เป็นหลัก การเปลี่ยนแปลงมาตรฐานต้องแก้ที่ไฟล์นี้เท่านั้น

มาตรฐานกลางสำหรับเริ่มโปรเจกต์ Frontend ใหม่ทุกโปรเจกต์ในบริษัท ไฟล์นี้ต้องอยู่ที่ root ของทุก repo (คัดลอกไปวางตอน scaffold โปรเจกต์ใหม่) และเป็นไฟล์แรกที่ทั้งพนักงานและ AI coding agent ต้องอ่านก่อนเริ่มเขียนโค้ด Claude Code จะโหลดไฟล์นี้เข้า context อัตโนมัติทุก session

---

## 1. Tech Stack (บังคับ ห้ามเลือกเอง)

| หมวด | เลือกใช้ | เหตุผล |
|---|---|---|
| Framework | React 18+ | ระบบนิเวศใหญ่สุด, AI coding agent generate โค้ดแม่นยำที่สุด, หาคนต่องานง่ายที่สุด |
| Meta-framework | Vite + React (SPA) หรือ Next.js (ถ้าต้องการ SSR/SEO) | มี convention ชัดเจน ลดการตัดสินใจจุกจิก |
| Language | TypeScript (`strict: true`) | บังคับทุกไฟล์ ห้ามใหม่เป็น `.js`/`.jsx` |
| Styling | Tailwind CSS | utility-first, AI generate ได้แม่นและไม่ต้องสลับไฟล์ CSS |
| State (local) | React state / Context | ใช้กับ state ง่าย ๆ ที่ไม่ share ข้ามหลายหน้า |
| State (global/server) | Zustand (client state) + TanStack Query (server state/cache) | แยกหน้าที่ชัดเจน ไม่ยัด API cache ลง Redux |
| Form | React Hook Form + Zod | validation แบบ schema, type-safe |
| HTTP client | Axios (instance เดียว ผ่าน `src/shared/services/api.ts`) | ห้าม import axios ตรง ๆ ในหน้า component |
| Testing | Vitest + React Testing Library, Playwright (e2e) | |
| Lint/Format | ESLint + Prettier (config กลางของบริษัท) | |
| Package manager | pnpm | เร็วกว่า npm, lockfile เดียวมาตรฐาน |
| Node version | ล็อกด้วย `.nvmrc` (LTS ล่าสุด ณ วันเริ่มโปรเจกต์) | |

> ถ้าจำเป็นต้องใช้เทคโนโลยีนอกตารางนี้ (เช่นโปรเจกต์ legacy หรือข้อจำกัดจากลูกค้า) ให้เพิ่ม section "Exceptions" ท้ายไฟล์นี้พร้อมเหตุผล ห้ามเปลี่ยน stack เงียบ ๆ

> **ข้อยกเว้น SPFx (SharePoint Framework):** SPFx มีข้อจำกัดของ platform ที่ override ตารางข้างบนบางแถว — **build tool** ใช้ gulp/webpack ที่มากับ Yeoman generator (ไม่ใช่ Vite), **package manager** มัก lock เป็น npm, **Node version** ต้องตามที่ SPFx เวอร์ชันนั้นรองรับ (มักเก่ากว่า LTS ล่าสุด), **styling** ใช้ SCSS module ที่มากับ scaffold ได้ (ไม่บังคับ Tailwind). ส่วนที่เหลือ (TypeScript strict, React, โครงสร้าง feature/shared, coding convention, testing) ยังยึดตามไฟล์นี้เหมือนเดิม

---

## 2. โครงสร้างโฟลเดอร์

```
src/
  app/              # ประกอบร่างแอป: entry, routing, providers
  features/         # โค้ดที่ผูกกับ domain เฉพาะ เช่น features/invoice, features/user
    <feature>/
      components/
      hooks/
      services.ts
      types.ts
  shared/           # โค้ดกลางที่ไม่ผูก domain ใด ใช้ข้ามหลาย feature ได้
    components/     # reusable UI (dumb, ไม่มี business logic) เช่น Button, Modal
    hooks/          # shared hooks เช่น useDebounce
    services/
      api.ts        # axios instance กลาง + interceptor
    types/          # shared TypeScript types
    utils/          # helper ล้วน ๆ เช่น formatDate
  assets/
```

**กฎ dependency (บังคับ):**
- `features/` import จาก `shared/` ได้ แต่ `shared/` **ห้าม** import จาก `features/` (ทางเดียวเท่านั้น ป้องกัน circular dependency)
- `features/` หนึ่งไม่ควร import ตรงจากอีก `features/` หนึ่ง — ถ้ามีของใช้ร่วมกัน ให้ยกขึ้นไป `shared/`

**เกณฑ์ตัดสินว่าโค้ดชิ้นหนึ่งอยู่ `shared/` หรือ `features/`:**
> "ถ้าลบทุก feature ทิ้ง โค้ดชิ้นนี้ยังมีความหมายอยู่ไหม" — ยัง → `shared/` (เช่น `Button`, `formatDate`), ไม่ → `features/<name>/` (เช่น `InvoiceTable`)

กฎ dependency ข้างต้นต้องบังคับด้วย ESLint จริง (ไม่ใช่แค่ข้อความ) — ดูวิธี setup ในข้อ 9

กฎการตั้งชื่อ:
- Component: `PascalCase.tsx` เช่น `InvoiceTable.tsx`
- Hook: `useCamelCase.ts` เช่น `useInvoiceList.ts`
- ไฟล์อื่น: `camelCase.ts`
- 1 component หลัก ต่อ 1 ไฟล์ ห้ามยัดหลาย component ไม่เกี่ยวข้องกันไว้ไฟล์เดียว

**Path alias (บังคับ):** import ข้ามโฟลเดอร์ต้องใช้ alias `@/` ที่ชี้ไปที่ `src/` เสมอ เช่น `import { Button } from "@/shared/components/Button"` ห้ามใช้ relative path ซ้อนหลายชั้น (`../../../shared/...`) — ทำให้ย้ายไฟล์ง่าย และ AI generate import ได้สม่ำเสมอ ตั้งค่า alias ที่ `tsconfig.json` (`compilerOptions.paths`) และ `vite.config.ts` (`resolve.alias`) ให้ตรงกัน

---

## 3. Coding Conventions

- ใช้ function component + hooks เท่านั้น ห้ามเขียน class component
- Props ต้องประกาศ type/interface เสมอ ห้ามใช้ `any` (ถ้าเลี่ยงไม่ได้จริง ๆ ต้องมีคอมเมนต์อธิบายเหตุผล)
- Business logic (การคำนวณ, validation, data transform) ต้องแยกออกจาก component ไปไว้ใน hook หรือ `services.ts` — component มีหน้าที่ render เป็นหลัก
- การเรียก API ทุกจุดต้องผ่าน `src/shared/services/api.ts` เท่านั้น ห้าม `axios.get(...)` ตรง ๆ ในไฟล์อื่น
- Error handling: ใช้ error boundary + toast/notification กลาง ห้าม `try/catch` แล้ว `console.log` เงียบ ๆ
- Commit message ตาม [Conventional Commits](https://www.conventionalcommits.org/) เช่น `feat:`, `fix:`, `refactor:`
- Branch naming: `feature/<ticket>-short-desc`, `fix/<ticket>-short-desc`

---

## 4. กฎสำหรับ AI Coding Agent

- ต้องอ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง และยึด stack ในข้อ 1 ห้ามเปลี่ยน framework/library หลักเอง
- ห้ามเพิ่ม dependency ใหม่โดยไม่แจ้งเหตุผลกับผู้ใช้ก่อน (โดยเฉพาะ UI library หรือ state library ตัวใหม่ที่ซ้ำซ้อนกับที่มีอยู่แล้ว)
- ก่อนถือว่างานเสร็จ ต้องรันและผ่านทั้งหมด:
  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  ```
- ห้ามลบหรือแก้ test ที่มีอยู่เพื่อให้ผ่านง่าย ๆ โดยไม่แจ้งเหตุผล
- โค้ดใหม่ที่มี business logic ต้องมี test คู่กันเสมอ (ไม่ต้องรอให้คนขอ)
- ไม่ต้องเขียนคอมเมนต์อธิบายว่าโค้ดทำอะไร (ชื่อตัวแปร/ฟังก์ชันต้องสื่อสารเอง) เขียนคอมเมนต์เฉพาะตอนมีเหตุผลที่ไม่ชัดเจนในตัวโค้ด (workaround, ข้อจำกัดจาก library, edge case)
- ถ้าโจทย์กำกวมหรือมีทางเลือกออกแบบมากกว่าหนึ่งที่ต่างกันชัดเจน (เช่น จะวางไฟล์ที่ `shared/` หรือ `features/`, จะเพิ่ม state library ตัวใหม่ไหม) ให้ **ถามก่อน** อย่าเดาแล้วเขียนโค้ดยาว ๆ ไปเลย — ถามสั้น ๆ ตรงประเด็นแล้วค่อยลงมือถูกกว่าเขียนผิดทิศแล้วรื้อ

---

## 5. Testing

- Coverage ขั้นต่ำ 70% สำหรับโค้ดใน `features/` และ `utils/`
- ต้องมี unit test สำหรับ: form validation, การคำนวณ/transform ข้อมูล, custom hooks ที่มี logic
- ต้องมี e2e test (Playwright) อย่างน้อยสำหรับ critical path (login, การทำรายการหลักของระบบ)
- ห้าม mock สิ่งที่ทดสอบพฤติกรรมจริงได้ง่าย ๆ (เช่น mock ทั้ง component แทนที่จะ render จริงแล้วเช็ค output)

---

## 6. Security & Performance Baseline

- ห้าม hardcode API key/secret/connection string ในโค้ด ต้องใช้ environment variable ผ่าน `.env` และต้องมี `.env.example` แนบไว้ (ไม่ commit `.env` จริง)
- ทุก form ที่รับ input จากผู้ใช้ต้อง validate ทั้งฝั่ง client (UX) และเชื่อ backend validate อีกชั้นเสมอ (client validation ไม่ใช่ security boundary)
- รูปภาพ/ไฟล์ที่โหลดจาก route ที่ไม่ critical ต้องทำ lazy load (`React.lazy` + `Suspense`)
- ตรวจ bundle size ก่อน merge งานใหญ่ (`vite build --report` หรือเทียบเท่า) ห้ามเพิ่ม dependency ที่ทำให้ bundle บวมโดยไม่จำเป็น
- Accessibility ขั้นต่ำ: ทุก interactive element ต้องกด tab ได้, รูปต้องมี `alt`, form ต้องมี `label`

---

## 7. Layer Boundary Enforcement (ESLint)

กฎ dependency ในข้อ 2 (`features → shared` ทางเดียว, feature ห้ามข้าม feature) ต้องบังคับด้วย ESLint จริง ไม่ใช่พึ่งวินัยคนเขียน **ตอนเริ่มโปรเจกต์ใหม่ให้สร้าง config นี้ขึ้นมา** (ยกเว้นโปรเจกต์ SPFx ที่มี ESLint มาให้แล้วในตัว — ให้ปรับ rule เข้ากับ config เดิมของ SPFx แทนการสร้างไฟล์ใหม่)

ติดตั้ง:
```bash
pnpm add -D eslint-plugin-boundaries
```

เพิ่ม block นี้เข้า `eslint.config.js` (ESLint flat config):
```js
import boundaries from "eslint-plugin-boundaries";

export default [
  // ...config อื่น ๆ (typescript, react, prettier)...
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "feature", pattern: "src/features/*", capture: ["featureName"] },
        { type: "shared", pattern: "src/shared/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // app ประกอบร่างแอป → import ได้ทุกชั้น
            { from: "app", allow: ["app", "feature", "shared"] },
            // feature → ใช้ shared ได้ + import ภายใน feature ตัวเองได้ แต่ห้ามข้ามไป feature อื่น
            {
              from: "feature",
              allow: ["shared", ["feature", { featureName: "${from.featureName}" }]],
            },
            // shared เป็นชั้นล่างสุด → import ได้เฉพาะ shared ด้วยกัน (กัน circular dependency)
            { from: "shared", allow: ["shared"] },
          ],
        },
      ],
      "boundaries/no-unknown": "error",
      "boundaries/no-unknown-files": "error",
    },
  },
];
```

หลัง setup แล้ว `pnpm lint` จะ error ทันทีถ้ามีการ import ผิดชั้น ถ้าโปรเจกต์วางโฟลเดอร์ไม่ตรง pattern ข้างบน ต้องปรับ `pattern` ใน `settings` ให้ตรงก่อน

---

## 8. Exceptions

> ระบุที่นี่เมื่อโปรเจกต์นี้จำเป็นต้องเบี่ยงจากมาตรฐานข้างต้น พร้อมเหตุผลและผู้อนุมัติ

โปรเจกต์นี้เป็น **SPFx (SharePoint Framework)** จึงมีการเบี่ยงจากมาตรฐานตามข้อจำกัดของ platform
(อนุมัติโดยเจ้าของงาน ตามคำสั่ง restructure วันที่ 2026-07-24):

1. **โครงสร้าง app/features/shared ซ้อนอยู่ใต้ `src/webparts/requisition/`** ไม่ใช่ที่ `src/` โดยตรง —
   เพราะ `config/config.json` ผูก bundle ไว้กับ `src/webparts/requisition/RequisitionWebPart.manifest.json`
   และ entry point ทำให้โฟลเดอร์ web part ย้ายไม่ได้ ไฟล์ entry/manifest/`loc/`/`assets/` (welcome png)
   จึงคงอยู่ที่ราก web part เหมือนเดิม
2. **Path alias `@/` ชี้ไป `src/webparts/requisition/`** (ไม่ใช่ `src/`) — เพราะ "ราก" ของโครงสร้างแอปคือ
   โฟลเดอร์ web part นี้ นอกจากนี้ tsc type-check กับ `src/` (ผ่าน `tsconfig.json` → `paths`) แต่ webpack
   bundle จาก `lib/` ที่คอมไพล์แล้ว จึงตั้ง alias สองปลายทางโดยตั้งใจ: tsc→`src`, webpack→`lib`
   (ดู `config/spfx-customize-webpack.js` ซึ่งใช้ extension point ทางการของ SPFx Heft
   `customize-spfx-webpack-configuration-plugin`)
3. **แต่ละ feature ใช้โฟลเดอร์ `services/` (หลายไฟล์) แทน `services.ts` ไฟล์เดียว** — เพื่อเลี่ยงไฟล์ยักษ์
   ตามหลัก no-spaghetti (เช่น `features/pa/services/` มีทั้ง `RequisitionService.ts` และ
   `PromotionActivityService.ts`)
4. **Build/Package manager/Node/Styling ตามข้อยกเว้น SPFx ในข้อ 1** — ใช้ Heft (ไม่ใช่ Vite), npm
   (ไม่ใช่ pnpm), Node ตามที่ SPFx 1.23 รองรับ, SCSS Modules (ไม่ใช่ Tailwind)
5. **`eslint-plugin-boundaries` ปักเวอร์ชัน `^4`** (ไม่ใช่ล่าสุด v7) — เพราะ v6/v7 เปลี่ยน DSL
   (`element-types`→`dependencies`, `rules`→`policies`, `${}`→`{{}}`) จนไม่ตรงกับ config ตัวอย่างในข้อ 7
   เพิ่ม `eslint-import-resolver-typescript` เพื่อให้ boundaries resolve `@/` alias ได้

> **อัปเดต 2026-08-03 (อนุมัติโดยเจ้าของงาน):** ข้อยกเว้น "ไม่มี `shared/services/api.ts`" ถูกยกเลิก
> โปรเจกต์นี้ย้ายจาก `SPHttpClient` มาใช้ **axios** เป็น client เดียวสำหรับเรียก SharePoint REST ทั้งหมด
> ตามมาตรฐานกลางข้อ 1/3 แล้ว (`src/webparts/requisition/shared/services/api.ts` — axios instance เดียว,
> `withCredentials: true` อ่าน session cookie ของ SharePoint, มี request interceptor ดึง/แคช
> `X-RequestDigest` จาก `/_api/contextinfo` ให้อัตโนมัติสำหรับ request ที่ไม่ใช่ GET เพราะ axios ไม่มีกลไก
> anti-CSRF ในตัวแบบ `SPHttpClient`) โปรเจกต์นี้จึงไม่มีข้อยกเว้นในส่วนนี้อีกต่อไป — ทุก service
> เรียกผ่าน `api.ts` ไฟล์เดียวตามมาตรฐาน

---

## 9. Checklist ก่อนเริ่มโปรเจกต์ใหม่

- [ ] คัดลอกไฟล์นี้ไปไว้ที่ root ของ repo ใหม่
- [ ] Scaffold ด้วย `pnpm create vite@latest <name> -- --template react-ts`
- [ ] ติดตั้ง ESLint/Prettier config กลางของบริษัท
- [ ] ตั้งค่า layer boundary rules ตามข้อ 7 (ยกเว้น SPFx — ปรับเข้า config เดิม)
- [ ] ตั้งค่า path alias `@/` → `src/` ที่ `tsconfig.json` + `vite.config.ts`
- [ ] ตั้งค่า `.nvmrc`, `.env.example`
- [ ] เพิ่ม CI pipeline: lint → typecheck → test → build
