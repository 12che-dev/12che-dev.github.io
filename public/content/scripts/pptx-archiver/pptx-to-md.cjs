const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. .env 파일 수동 읽기 (zero dependencies)
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                let val = match[2] || '';
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1);
                }
                process.env[match[1]] = val;
            }
        });
    } catch (e) {
        console.warn(".env 파일을 찾을 수 없거나 읽을 수 없습니다.");
    }
}

loadEnv();

if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY가 설정되지 않았습니다.");
    process.exit(1);
}

const API_KEY = process.env.GEMINI_API_KEY;

// 2. Gemini API 수동 호출 (fetch 사용)
async function translateText(text) {
    if (!text || !text.trim()) return "";
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        const body = {
            contents: [{
                parts: [{
                    text: `다음은 프레젠테이션의 발표자 노트(인터뷰어 코멘트) 원문입니다. 원문의 뉘앙스를 살려 한국어로 자연스럽게 번역해주세요.\n\n${text}`
                }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error("API 응답 에러:", response.status, response.statusText);
            return text;
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error("번역 에러:", e.message);
        return text;
    }
}

function extractTextFromXml(xmlStr) {
    const matches = xmlStr.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (!matches) return "";
    return matches.map(m => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '')).join(' ');
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("사용법: node scripts/pptx-archiver/pptx-to-md.js \"원본.pptx\"");
        process.exit(1);
    }

    const pptxPath = path.resolve(args[0]);
    if (!fs.existsSync(pptxPath)) {
        console.error("파일을 찾을 수 없습니다:", pptxPath);
        process.exit(1);
    }

    const basename = path.basename(pptxPath, '.pptx').replace('.zip', '');
    const baseDir = path.join(process.cwd(), 'public', 'content', '강연리뷰', 'cedec_강연자료');
    const outDir = path.join(baseDir, basename);
    const mediaDir = path.join(outDir, 'media');
    
    fs.mkdirSync(mediaDir, { recursive: true });

    console.log(`[1/3] PPTX 압축 해제 (tar.exe 사용)...`);
    const extractDir = path.join(process.cwd(), '.temp_pptx_extract');
    if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    try {
        // Windows PowerShell을 사용하여 압축 해제 (유니코드 경로 지원)
        execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${pptxPath}' -DestinationPath '${extractDir}' -Force"`);
    } catch (e) {
        console.error("압축 해제 실패:", e.message);
        process.exit(1);
    }

    console.log(`[2/3] 슬라이드 분석 및 번역 진행 중...`);
    const slidesDir = path.join(extractDir, 'ppt', 'slides');
    if (!fs.existsSync(slidesDir)) {
        console.error("슬라이드 폴더를 찾을 수 없습니다.");
        process.exit(1);
    }

    const slideFiles = fs.readdirSync(slidesDir).filter(f => f.match(/^slide\d+\.xml$/));
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)[1]);
        const numB = parseInt(b.match(/slide(\d+)/)[1]);
        return numA - numB;
    });

    let markdownContent = `---
title: "${basename}"
group: 3
val: 20
links: 
---

# ${basename}

`;

    for (let i = 0; i < slideFiles.length; i++) {
        const slideFileName = slideFiles[i];
        const slideNum = slideFileName.match(/slide(\d+)/)[1];
        
        markdownContent += `## Slide ${i + 1}\n\n`;

        const relsFilePath = path.join(slidesDir, '_rels', `${slideFileName}.rels`);
        let notesTarget = null;

        if (fs.existsSync(relsFilePath)) {
            const relsXml = fs.readFileSync(relsFilePath, 'utf8');
            
            // 이미지 추출
            const imageMatches = [...relsXml.matchAll(/Target="\.\.\/media\/(image\d+\.[a-zA-Z]+)"/g)];
            if (imageMatches.length > 0) {
                for (const match of imageMatches) {
                    const imageName = match[1];
                    const sourceImagePath = path.join(extractDir, 'ppt', 'media', imageName);
                    if (fs.existsSync(sourceImagePath)) {
                        fs.copyFileSync(sourceImagePath, path.join(mediaDir, imageName));
                        markdownContent += `![Slide Image](./media/${imageName})\n`;
                    }
                }
                markdownContent += '\n';
            }

            // 노트 추출
            const notesMatch = relsXml.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
            if (notesMatch) {
                notesTarget = notesMatch[1];
            }
        }

        // 발표자 노트 추출 및 번역
        if (notesTarget) {
            const notesFilePath = path.join(extractDir, 'ppt', 'notesSlides', notesTarget);
            if (fs.existsSync(notesFilePath)) {
                const notesXml = fs.readFileSync(notesFilePath, 'utf8');
                const rawText = extractTextFromXml(notesXml);
                if (rawText.trim()) {
                    console.log(` - 슬라이드 ${i + 1}/${slideFiles.length} 번역 중...`);
                    const translated = await translateText(rawText);
                    markdownContent += `> **발표자 노트:**\n`;
                    const lines = translated.split('\n');
                    for (const line of lines) {
                        markdownContent += `> ${line}\n`;
                    }
                    markdownContent += '\n';
                }
            }
        }

        markdownContent += `---\n\n`;
    }

    console.log(`[3/3] 마크다운 파일 저장 중...`);
    const mdPath = path.join(outDir, `${basename}.md`);
    fs.writeFileSync(mdPath, markdownContent, 'utf8');

    // 임시 폴더 삭제
    fs.rmSync(extractDir, { recursive: true, force: true });

    console.log(`\n🎉 완료되었습니다!`);
    console.log(`=> 파일 저장 위치: ${mdPath}`);
}

main().catch(console.error);
