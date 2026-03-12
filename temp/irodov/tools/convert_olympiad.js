import fs from 'fs';
import * as cheerio from 'cheerio';
import path from 'path';

// Stop parsing when we hit these sections at the END of the file
const STOP_SECTIONS = ['版权信息', '命题人', '审审题人', '联系方式'];

function parseQuestions(htmlPath) {
  const content = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(content);
  
  const problems = [];
  let currentMainProblem = null;
  let stopped = false;
  let firstProblemFound = false;

  console.log(`\n--- Parsing ${path.basename(htmlPath)} ---`);

  $('#preview-content').children().each((i, el) => {
    if (stopped) return;

    let elText = $(el).text().trim();
    if (!elText) return; 

    const elHtml = $.html(el);

    // Identify Main Problem
    const mainMatch = elText.match(/^([一二三四五六七八九十]+)[、．.]/);
    const latinMainMatch = elText.match(/^([A-Z])[．.](?!(\d|h|手))/); 

    if (mainMatch || latinMainMatch) {
      const id = mainMatch ? mainMatch[1] : latinMainMatch[1];
      console.log(`Main Problem Found: ${id}`);
      
      currentMainProblem = {
        id: id,
        title: elText.split('\n')[0].trim(),
        points: extractPoints(elText),
        content: [],
        subProblems: []
      };
      const $local = cheerio.load(elHtml);
      const $elCleaned = $local(':root');
      cleanScores($local, $elCleaned);
      currentMainProblem.content.push($local.html($elCleaned));
      problems.push(currentMainProblem);
      firstProblemFound = true;
    }
    // STOP check
    else if (firstProblemFound && STOP_SECTIONS.some(s => elText.includes(s))) {
      stopped = true;
      return;
    }
    // Table Merging Logic (Problem content side)
    else if (firstProblemFound) {
      if (currentMainProblem) {
        const lastIndex = currentMainProblem.content.length - 1;
        const lastElHtml = lastIndex >= 0 ? currentMainProblem.content[lastIndex] : null;
        
        const $current = $(el);
        const isCurrentTable = $current.hasClass('table') || $current.find('table').length > 0;
        
        if (isCurrentTable && lastElHtml) {
          const $last = cheerio.load(lastElHtml)(':root');
          const isLastTable = $last.hasClass('table') || $last.find('table').length > 0;
          
          if (isLastTable) {
            const lastColCount = $last.find('tr').first().find('td, th').length;
            const currColCount = $current.find('tr').first().find('td, th').length;
            const hasNewHeader = $current.find('tr').first().text().includes('帧数'); 

            if (lastColCount === currColCount && !hasNewHeader) {
              const $lastTableOrig = $last.find('table.tabular tbody');
              const $currTableRows = $current.find('table.tabular tbody tr');
              
              if ($lastTableOrig.length > 0 && $currTableRows.length > 0) {
                console.log('Merging split table parts...');
                const $local = cheerio.load(lastElHtml);
                const $lastTable = $local('table.tabular tbody');
                $lastTable.append($currTableRows);
                $lastTable.find('td').css('text-align', 'center'); 
                cleanScores($local, $local(':root'));
                currentMainProblem.content[lastIndex] = $local.html($local(':root'));
                return;
              }
            }
          }
        }
        
        if (isCurrentTable) {
          const $local = cheerio.load(elHtml);
          const $temp = $local(':root');
          $temp.find('td').css('text-align', 'center');
          cleanScores($local, $temp);
          currentMainProblem.content.push($local.html($temp));
        } else {
          const $local = cheerio.load(elHtml);
          const $temp = $local(':root');
          cleanScores($local, $temp);
          currentMainProblem.content.push($local.html($temp));
        }
      }
    }
  });

  return problems;
}

function cleanScores($, $context) {
  // Regex to match "1.0pt", "8．0pt", "2． 0pt" etc.
  const scoreRegex = /\d+[\.．]\s*\d+pt/i;
  
  $context.find('*').contents().each((i, node) => {
    if (node.type === 'text') {
      const text = node.data;
      if (scoreRegex.test(text)) {
        // Find if this is inside a td
        const $parentTd = $(node).closest('td');
        if ($parentTd.length > 0 && $parentTd.text().trim().match(/^\d+[\.．]\s*\d+pt$/i)) {
             // If the whole cell is just a score, remove the cell contents
             $parentTd.empty();
             // Often these are in dedicated rows or sub-tables just for score
             const $row = $parentTd.closest('tr');
             if ($row.find('td').text().trim() === '') {
                 $row.remove();
             }
        } else {
             // Replace text
             node.data = text.replace(scoreRegex, '');
        }
      }
    }
  });

  // Also catch completely empty empty td that used to hold scores
  $context.find('td').each((i, td) => {
    const text = $(td).text().trim();
    if (scoreRegex.test(text) && text.replace(scoreRegex, '').trim() === '') {
        $(td).closest('tr').remove();
    }
  });
}

function extractPoints(text) {
  const match = text.match(/[（(](\d+)\s*分[）)]/);
  return match ? parseInt(match[1]) : 0;
}

function parseAnswers(htmlPath, isExperiment = false) {
  const content = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(content);
  const answers = {};
  
  const sections = isExperiment ? ['A', 'B', 'C'] : ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  
  if (isExperiment) {
    let currentKey = null;
    $('#preview-content').children().each((i, el) => {
      const $el = $(el);
      const elText = $el.text();
      
      const keys = ['A', 'B', 'C'];
      let newKey = null;
      keys.forEach(k => {
        const regex = new RegExp(`${k}[．. ]\\s*\\d`, 'm');
        if (regex.test(elText)) {
          if (!newKey || keys.indexOf(k) > keys.indexOf(newKey)) {
             newKey = k;
          }
        }
      });

      if (newKey) currentKey = newKey;
      if (currentKey) {
        // Clean scores before adding
        const $local = cheerio.load($.html(el));
        const $temp = $local(':root');
        cleanScores($local, $temp);
        
        answers[currentKey] = (answers[currentKey] || '') + $local.html($temp);
      }
    });
  } else {
    let currentKey = null;
    $('#preview-content').children().each((i, el) => {
      const $el = $(el);
      const elText = $el.text().trim();
      const match = elText.match(/^([一二三四五六七八九十]+)[、．.]/);
      if (match) currentKey = match[1];
      if (currentKey) {
        // Clean scores
        const $local = cheerio.load($.html(el));
        const $temp = $local(':root');
        cleanScores($local, $temp);
        answers[currentKey] = (answers[currentKey] || '') + $local.html($temp);
      }
    });
  }

  return answers;
}

function mergeData(questions, answers) {
  questions.forEach(mainQ => {
    if (answers[mainQ.id]) mainQ.solution = answers[mainQ.id];
  });
  return questions;
}

const outputDir = '/Users/ariunboldganbold/Desktop/books/irodov/public/data/CHPOS-problems/CHPOS28';
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// === Experiment ===
const expQPath = '/Users/ariunboldganbold/Desktop/books/tex/CHPOS/CHPOS28/28届cphos实验试题（决赛模拟）.html';
const expAPath = '/Users/ariunboldganbold/Desktop/books/tex/CHPOS/CHPOS28/28届cphos实验答案.html';
if (fs.existsSync(expQPath) && fs.existsSync(expAPath)) {
  const expQ = parseQuestions(expQPath);
  const expA = parseAnswers(expAPath, true);
  const mergedExp = mergeData(expQ, expA);
  fs.writeFileSync(path.join(outputDir, 'experiment.json'), JSON.stringify(mergedExp, null, 2));
  console.log('Final Experiment problems:', mergedExp.length);
}

// === Theory ===
const theoryQPath = '/Users/ariunboldganbold/Desktop/books/tex/CHPOS/CHPOS28/第28届CPHOS物理竞赛联考理论试题.html';
const theoryAPath = '/Users/ariunboldganbold/Desktop/books/tex/CHPOS/CHPOS28/第28届CPHOS物理竞赛联考理论试题解答.html';
if (fs.existsSync(theoryQPath) && fs.existsSync(theoryAPath)) {
  const theoryQ = parseQuestions(theoryQPath);
  const theoryA = parseAnswers(theoryAPath, false);
  const mergedTheory = mergeData(theoryQ, theoryA);
  fs.writeFileSync(path.join(outputDir, 'theory.json'), JSON.stringify(mergedTheory, null, 2));
  console.log('Final Theory problems:', mergedTheory.length);
}
