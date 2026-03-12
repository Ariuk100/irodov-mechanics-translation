#!/usr/bin/env node
/**
 * Extract all Irodov Problems in General Physics sections from tex file
 * Creates one JSON file per section under irodov-problems/
 */

const fs = require('fs');
const path = require('path');

const TEX_FILE = path.join(__dirname, '..', 'tex', 'irodov-problems.tex');
const OUTPUT_BASE = path.join(__dirname, 'public', 'data', 'irodov-problems');

// ── Section definitions ─────────────────────────────────────────────────────
const SECTIONS = [
  // Part 1
  { id: '1.1', part: 'part_1', title: '1.1. Kinematics' },
  { id: '1.2', part: 'part_1', title: '1.2. The Fundamental Equation of Dynamics' },
  { id: '1.3', part: 'part_1', title: '1.3. Laws of Conservation of Energy, Momentum, and Angular Momentum' },
  { id: '1.4', part: 'part_1', title: '1.4. Universal Gravitation' },
  { id: '1.5', part: 'part_1', title: '1.5. Dynamics of a Solid Body' },
  { id: '1.6', part: 'part_1', title: '1.6. Elastic Deformations of a Solid Body' },
  { id: '1.7', part: 'part_1', title: '1.7. Hydrodynamics' },
  { id: '1.8', part: 'part_1', title: '1.8. Relativistic Mechanics' },
  // Part 2
  { id: '2.1', part: 'part_2', title: '2.1. Equation of the Gas State. Processes' },
  { id: '2.2', part: 'part_2', title: '2.2. The First Law of Thermodynamics. Heat Capacity' },
  { id: '2.3', part: 'part_2', title: '2.3. Kinetic Theory of Gases. Boltzmann\'s Law and Maxwell\'s Distribution' },
  { id: '2.4', part: 'part_2', title: '2.4. The Second Law of Thermodynamics. Entropy' },
  { id: '2.5', part: 'part_2', title: '2.5. Liquids. Capillary Effects' },
  { id: '2.6', part: 'part_2', title: '2.6. Phase Transformations' },
  { id: '2.7', part: 'part_2', title: '2.7. Transport Phenomena' },
  // Part 3
  { id: '3.1', part: 'part_3', title: '3.1. Constant Electric Field in Vacuum' },
  { id: '3.2', part: 'part_3', title: '3.2. Conductors and Dielectrics in an Electric Field' },
  { id: '3.3', part: 'part_3', title: '3.3. Electric Capacitance. Energy of an Electric Field' },
  { id: '3.4', part: 'part_3', title: '3.4. Electric Current' },
  { id: '3.5', part: 'part_3', title: '3.5. Constant Magnetic Field. Magnetics' },
  { id: '3.6', part: 'part_3', title: '3.6. Electromagnetic Induction. Maxwell\'s Equations' },
  { id: '3.7', part: 'part_3', title: '3.7. Motion of Charged Particles in Electric and Magnetic Fields' },
  // Part 4
  { id: '4.1', part: 'part_4', title: '4.1. Mechanical Oscillations' },
  { id: '4.2', part: 'part_4', title: '4.2. Electric Oscillations' },
  { id: '4.3', part: 'part_4', title: '4.3. Elastic Waves. Acoustics' },
  { id: '4.4', part: 'part_4', title: '4.4. Electromagnetic Waves. Radiation' },
  // Part 5
  { id: '5.1', part: 'part_5', title: '5.1. Photometry and Geometrical Optics' },
  { id: '5.2', part: 'part_5', title: '5.2. Interference of Light' },
  { id: '5.3', part: 'part_5', title: '5.3. Diffraction of Light' },
  { id: '5.4', part: 'part_5', title: '5.4. Polarization of Light' },
  { id: '5.5', part: 'part_5', title: '5.5. Dispersion and Absorption of Light' },
  { id: '5.6', part: 'part_5', title: '5.6. Optics of Moving Sources' },
  { id: '5.7', part: 'part_5', title: '5.7. Thermal Radiation. Quantum Nature of Light' },
  // Part 6
  { id: '6.1', part: 'part_6', title: '6.1. Scattering of Particles. Rutherford-Bohr Atom' },
  { id: '6.2', part: 'part_6', title: '6.2. Wave Properties of Particles. Schrödinger Equation' },
  { id: '6.3', part: 'part_6', title: '6.3. Properties of Atoms. Spectra' },
  { id: '6.4', part: 'part_6', title: '6.4. Molecules and Crystals' },
  { id: '6.5', part: 'part_6', title: '6.5. Radioactivity' },
  { id: '6.6', part: 'part_6', title: '6.6. Nuclear Reactions' },
  { id: '6.7', part: 'part_6', title: '6.7. Elementary Particles' },
];

// ── LaTeX → readable text conversion ────────────────────────────────────────
function convertLatex(text) {
  if (!text) return '';

  // Remove \\ line breaks at end of lines (keep content)
  text = text.replace(/\\\\\s*$/gm, '');
  text = text.replace(/\\\\\s*\n/g, '\n');

  // Convert display math \[...\] → $$...$$
  text = text.replace(/\\\[\s*/g, '$$\n').replace(/\s*\\\]/g, '\n$$');

  // Convert inline math \(...\) → $...$
  text = text.replace(/\\\(/g, '$').replace(/\\\)/g, '$');

  // Convert \begin{equation*}...\end{equation*}
  text = text.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, m) => `$$${m.trim()}$$`);

  // Convert \begin{align*}...\end{align*}
  text = text.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, m) => `$$${m.trim()}$$`);

  // Convert \begin{itemize}...\end{itemize} – keep \item as bullet
  text = text.replace(/\\begin\{itemize\}/g, '').replace(/\\end\{itemize\}/g, '');
  text = text.replace(/^\s*\\item\s*/gm, '- ');

  // Convert \begin{enumerate}...\end{enumerate}
  text = text.replace(/\\begin\{enumerate\}/g, '').replace(/\\end\{enumerate\}/g, '');

  // Remove figure environments entirely (handled separately)
  text = text.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, '');

  // Remove \tag{...}
  text = text.replace(/\\tag\{[^}]*\}/g, '');

  // Remove \captionsetup, \caption{}, \begin{center}, \end{center}
  text = text.replace(/\\captionsetup\{[^}]*\}/g, '');
  text = text.replace(/\\begin\{center\}/g, '').replace(/\\end\{center\}/g, '');

  // Remove \includegraphics lines
  text = text.replace(/\\includegraphics[^\n]*/g, '');

  // Remove \label{} \ref{} \cite{}
  text = text.replace(/\\label\{[^}]*\}/g, '');
  text = text.replace(/\\ref\{[^}]*\}/g, '');

  // Remove \nonumber
  text = text.replace(/\\nonumber/g, '');

  // Remove \hspace, \vspace, \medskip, \bigskip, \smallskip
  text = text.replace(/\\[hv]space\*?\{[^}]*\}/g, '');
  text = text.replace(/\\(med|big|small)skip/g, '');

  // Remove \noindent, \centering
  text = text.replace(/\\noindent\s*/g, '');
  text = text.replace(/\\centering\s*/g, '');

  // Remove \text{...} wrapper in math (keep content)
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');

  // Tidy up multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// Extract figure info: { id, caption }
function extractFigures(block) {
  const figures = [];
  const re = /\\begin\{figure\}([\s\S]*?)\\end\{figure\}/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const inner = m[1];
    const imgMatch = inner.match(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/);
    const capMatch = inner.match(/\\caption\{([^}]*)\}/);
    if (imgMatch) {
      figures.push({
        src: `images/irodov-problems/${imgMatch[1]}.jpg`,
        caption: capMatch ? capMatch[1].replace(/\\textit\{|\}/g, '') : '',
      });
    }
  }
  return figures;
}

// Build statement/answer array from raw text block
function buildContentArray(rawText) {
  const items = [];

  // Split on figure boundaries
  const parts = rawText.split(/(\\begin\{figure\}[\s\S]*?\\end\{figure\})/);

  for (const part of parts) {
    const figMatch = part.match(/\\begin\{figure\}([\s\S]*?)\\end\{figure\}/);
    if (figMatch) {
      const inner = figMatch[1];
      const imgMatch = inner.match(/\\includegraphics(?:\[.*?\])?\{([^}]+)\}/);
      const capMatch = inner.match(/\\caption\{([^}]*)\}/);
      if (imgMatch) {
        items.push({
          type: 'image',
          src: `images/irodov-problems/${imgMatch[1]}.jpg`,
          caption: capMatch ? capMatch[1].replace(/\\textit\{|\}/g, '') : '',
        });
      }
    } else {
      const converted = convertLatex(part);
      if (converted.trim()) {
        items.push({ type: 'text', value: converted });
      }
    }
  }

  if (items.length === 0) {
    return [{ type: 'text', value: '' }];
  }
  return items;
}

// ── Main parsing ─────────────────────────────────────────────────────────────
function parse() {
  const raw = fs.readFileSync(TEX_FILE, 'utf8');
  const lines = raw.split('\n');

  // Find answer section start: first line starting with "1.1. " after problems
  // Answers start around line 8846
  let answerStart = -1;
  for (let i = 8000; i < lines.length; i++) {
    if (/^1\.1\. /.test(lines[i])) {
      answerStart = i;
      break;
    }
  }
  if (answerStart === -1) throw new Error('Could not find answers section');

  console.log(`Answers start at line ${answerStart + 1}`);

  const problemText = lines.slice(0, answerStart).join('\n');
  const answerText = lines.slice(answerStart).join('\n');

  // ── Parse answers ──────────────────────────────────────────────────────────
  // Each answer starts with pattern like "1.1. " or "2.156. "
  const answers = new Map(); // Map<probNum, rawAnswerText>

  // Tokenize answer section: split on problem number patterns
  const answerTokenRe = /(?:^|\n)(\d+\.\d+)\. /g;
  const answerMatches = [...answerText.matchAll(/(?:^|\n)(\d+\.\d+)\. ([\s\S]*?)(?=\n\d+\.\d+\. |$)/g)];

  // Build answers map
  for (const m of answerMatches) {
    const num = m[1];
    const ansText = m[2].trim();
    answers.set(num, ansText);
  }

  console.log(`Parsed ${answers.size} answers`);

  // ── Find section boundaries in problem text ──────────────────────────────
  const subsectionRe = /\\subsection\*\{(\d+\.\d+)\. ([^}]+)\}/g;
  const sectionBoundaries = []; // { id, title, startIdx }

  let sm;
  while ((sm = subsectionRe.exec(problemText)) !== null) {
    sectionBoundaries.push({
      id: sm[1],
      title: sm[1] + '. ' + sm[2],
      startIdx: sm.index,
    });
  }

  console.log(`Found ${sectionBoundaries.length} sections`);

  // ── Parse each section ────────────────────────────────────────────────────
  const sectionData = new Map(); // Map<sectionId, { intro, problems[] }>

  for (let si = 0; si < sectionBoundaries.length; si++) {
    const sec = sectionBoundaries[si];
    const nextSec = sectionBoundaries[si + 1];

    // Extract raw text of this section
    const secStart = sec.startIdx;
    const secEnd = nextSec ? nextSec.startIdx : problemText.length;
    const secRaw = problemText.slice(secStart, secEnd);

    // The prefix is the section number (e.g., "1" for section 1.x, "2" for 2.x)
    const secPrefix = sec.id.split('.')[0];

    // Find where first problem starts in this section
    // Problems start with their number like "1.1." at start of a paragraph
    const probNumPattern = new RegExp(`(?:^|\\n)(${secPrefix}\\.\\d+)\\.\\s+`, 'g');

    const probMatches = [];
    let pm;
    while ((pm = probNumPattern.exec(secRaw)) !== null) {
      probMatches.push({ num: pm[1], idx: pm.index + (pm[0].startsWith('\n') ? 1 : 0), matchLen: pm[0].length });
    }

    // Intro = text before first problem
    const introRaw = probMatches.length > 0 ? secRaw.slice(0, probMatches[0].idx) : secRaw;

    // Build problems
    const problems = [];
    for (let pi = 0; pi < probMatches.length; pi++) {
      const pm = probMatches[pi];
      const nextPm = probMatches[pi + 1];

      const probStart = pm.idx + pm.matchLen;
      const probEnd = nextPm ? nextPm.idx : secRaw.length;

      const probRaw = secRaw.slice(probStart, probEnd);
      const answerRaw = answers.get(pm.num) || '';

      problems.push({
        number: pm.num,
        statementRaw: probRaw,
        answerRaw,
      });
    }

    sectionData.set(sec.id, {
      id: sec.id,
      title: sec.title,
      introRaw,
      problems,
    });
  }

  // ── Generate JSON per section ──────────────────────────────────────────────
  for (const sec of SECTIONS) {
    const data = sectionData.get(sec.id);
    if (!data) {
      console.warn(`  WARNING: Section ${sec.id} not found in tex`);
      continue;
    }

    // Create output directory
    const outDir = path.join(OUTPUT_BASE, sec.part);
    fs.mkdirSync(outDir, { recursive: true });

    // Build intro text
    const introText = buildIntroText(data.introRaw, data.id);

    // Build body
    const body = [];

    // Intro block
    if (introText.trim()) {
      body.push({ value: introText });
    }

    // Problems
    for (const prob of data.problems) {
      const stmt = buildContentArray(prob.statementRaw);
      const ans = prob.answerRaw.trim()
        ? buildContentArray(prob.answerRaw)
        : [{ type: 'text', value: '' }];

      body.push({
        type: 'problem',
        number: prob.number,
        title: '',
        statement: stmt,
        answer: ans,
      });
    }

    const jsonObj = {
      id: sec.id,
      title: sec.title,
      body,
    };

    const outFile = path.join(outDir, `${sec.id}.json`);
    fs.writeFileSync(outFile, JSON.stringify(jsonObj, null, 2), 'utf8');
    console.log(`  Written: ${sec.part}/${sec.id}.json (${data.problems.length} problems)`);
  }

  console.log('\nDone!');
}

// Build intro text from raw LaTeX section header block
function buildIntroText(raw, secId) {
  // Extract section title
  const titleMatch = raw.match(/\\subsection\*\{([^}]+)\}/);
  const titleText = titleMatch ? titleMatch[1] : secId;

  // Remove the subsection header itself
  let body = raw.replace(/\\subsection\*\{[^}]+\}/, '').trim();

  // Convert LaTeX
  body = convertLatex(body);

  // Remove leading/trailing empty lines
  body = body.replace(/^\s+/, '').replace(/\s+$/, '');

  return `## ${titleText}\n\n${body}`;
}

// ── Run ───────────────────────────────────────────────────────────────────────
try {
  parse();
} catch (e) {
  console.error('Error:', e.message);
  console.error(e.stack);
  process.exit(1);
}
