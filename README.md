# 📑 Tender Document Package Builder

> **AI DevFest 2026** — Professional, 100% Client-Side, Privacy-Preserving Tender Document Package Builder for Public Procurement.

[![Build & Deploy](https://github.com/Moontakim-Moon/Tender_Document_Package_Builder/actions/workflows/deploy.yml/badge.svg)](https://github.com/Moontakim-Moon/Tender_Document_Package_Builder/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB.svg)](https://react.dev/)
[![Offline Client-Side](https://img.shields.io/badge/Architecture-100%25%20Offline%20Client--Side-brightgreen.svg)]()

---

## 🌟 Executive Summary

In government and corporate procurement (e.g., e-GP and public tenders in Bangladesh), submitting incomplete, expired, unordered, or duplicate documents causes immediate bid disqualification.

**Tender Document Package Builder** empowers procurement officers, bidders, and administrative staff to assemble dozens of scattered PDF documents into a single, correctly ordered, validated, numbered, and submission-ready tender PDF package in seconds.

### 🛡️ Core Architecture & Privacy Guarantee
- **100% Client-Side Processing**: Documents and tender configurations never leave the browser. Zero server uploads, zero third-party telemetry, zero cloud data leakage.
- **Works Completely Offline**: Once loaded, all PDF parsing, page extraction, SHA-256 hashing, merging, stamping, and CSV checklist generation execute locally in web workers/client memory.

---

## ✨ Key Features & Contest Specification Compliance

### 1. Requirements Configuration (`requirements.json`)
- Intuitive drag-and-drop or file upload for the authoritative `requirements.json`.
- Strict schema validation ensuring `tender_id`, `procuring_entity`, `bidder`, `submission_deadline`, and requirements array with unique `id` and `order` attributes.
- Built-in one-click **"Load Sample Tender"** pre-loaded with representative Bangladeshi procurement requirements (Trade License, TIN, Bank Solvency, Experience Certificates, etc.).

### 2. Multi-File PDF Upload & Integrity Verification
- Batch drag-and-drop PDF upload with format validation.
- **Magic-Byte Integrity Check**: Validates the `%PDF-` file header signature to detect corrupted or disguised files.
- **SHA-256 Client-Side Deduplication**: Hashes every file in the browser using the Web Crypto API. Identical duplicate uploads are automatically flagged and linked to their primary file.
- Real-time page count extraction and file size formatting.

### 3. Smart Matching & Expiry Management
- Interactive requirement-to-file matching interface.
- **Smart Heuristic Match Suggestions**: Token similarity and fuzzy matching automatically suggest the best document for each requirement slot.
- **Expiry Date Tracker**: Seamless date pickers for documents requiring validity verification against the official tender submission deadline.
- Instant visual feedback on matched status, page counts, and file details.

### 4. Authoritative Status & Validation Engine
The validation engine implements the single source of truth according to official rules:
| Status Badge | Condition | Blocks Generation? |
| :--- | :--- | :---: |
| <kbd>✗ Missing</kbd> | Mandatory requirement without a file | **YES (Blocks)** |
| <kbd>⏰ Expiry Needed</kbd> | Document requires validity date but none entered | **YES (Blocks)** |
| <kbd>⚠ Expired</kbd> | Expiry date is before the tender submission deadline | **YES (Blocks)** |
| <kbd>○ Not Provided</kbd> | Optional requirement without a file | **NO (Allowed)** |
| <kbd>✓ OK</kbd> | Matched, valid, and unexpired | **NO (Ready)** |

### 5. Automated PDF Packaging & Stamping
- **Official Cover Page**: Dynamically generated cover sheet featuring procuring entity, bidder, tender ID, submission deadline, table of contents, and generation timestamp.
- **Document Sorting**: Strict ordering enforced by the requirement specification (`order: 1, 2, 3...`).
- **Running Footers & Page Stamping**: Every page of the generated package receives a standardized running header/footer showing tender ID and current/total page numbering (`Page X of Y`).
- **Generation Gate**: The "Generate Package" button is disabled whenever blocking issues exist, complete with an itemized blocker checklist.

### 6. Bilingual Localization (English & বাংলা)
- Full bilingual interface supporting English and Bengali.
- Native typography using Google Fonts *Noto Sans Bengali* and *Inter*.
- Accessible color scheme pairing semantic colors with high-contrast icons and text labels (WCAG AAA compliant).

### 7. Supplementary Export
- **CSV Checklist Export**: Generates an audit checklist formatted with a UTF-8 Byte Order Mark (`\uFEFF`) ensuring proper Bengali character display when opened in Microsoft Excel.

---

## 🛠️ Technology Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Modern Vanilla CSS Design System (CSS Custom Properties, Glassmorphism, Micro-interactions)
- **PDF Engine**: `pdf-lib` for client-side vector synthesis, merging, stamping, and font rendering
- **Hashing**: Web Crypto API (`crypto.subtle.digest('SHA-256')`)
- **CSV Processing**: PapaParse
- **Automated Testing**: Node.js Native Test Runner (`node --test`)

---

## 🚀 Quick Start & Local Development

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/Moontakim-Moon/Tender_Document_Package_Builder.git
cd Tender_Document_Package_Builder

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev

# Open http://localhost:5173 in your browser
```

### Running Test Suite
```bash
# Execute automated unit and business logic tests
npm test
```

### Production Build
```bash
# Compile TypeScript and bundle production assets
npm run build

# Preview production build locally
npm run preview
```

---

## 🧪 Test Coverage

The test suite validates critical business logic:
- `tests/validation.test.mjs`:
  - Date validity and chronological deadline comparison
  - Requirement status evaluation matrix (all 5 states)
  - Blocker detection logic
  - Strict `requirements.json` schema validation
- `tests/export-matching.test.mjs`:
  - UTF-8 BOM CSV checklist generation in English and Bangla
  - Filename token similarity heuristic engine

---

## 🚢 Deployment

The project is configured for continuous deployment:

- **GitHub Pages**: Automated workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) triggers on pushes to `main`.
- **Vercel**: Pre-configured [`vercel.json`](vercel.json).
- **Netlify**: Pre-configured [`netlify.toml`](netlify.toml).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
