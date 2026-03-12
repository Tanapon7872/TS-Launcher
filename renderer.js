const { Client } = require('minecraft-launcher-core');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http'); 
const axios = require('axios');
const crypto = require('crypto');
const { shell, ipcRenderer } = require('electron'); 
const { spawn } = require('child_process');

const launcher = new Client();
const os = require('os');
const baseDir = path.join(os.homedir(), 'AppData', 'Roaming', 'TSLauncherData');

// 👇 [NONG SUM UPDATE] เติม 3 บรรทัดนี้ลงไป เพื่อสั่งให้สร้างโฟลเดอร์ฐานทัพเตรียมไว้เสมอ!
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
}
let modpacks = {}; 
let launcherSettings = {}; 

const MASTER_URL = "https://www.dropbox.com/scl/fi/0yte43v9ycnixsrawdnrl/modpacks.json?rlkey=m2zpi8lm0m4top6z0khw7iw8l&st=jqnysgne&dl=1";

window.addLog = (msg, type="info") => {
    const logDiv = document.getElementById('log-display');
    if (logDiv) {
        const line = document.createElement('div');
        line.style.color = type === "error" ? "#ff4444" : (type === "success" ? "#00ff88" : "#ccc");
        line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logDiv.appendChild(line);
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    console.log(`[${type}] ${msg}`);
};

function setMiniLog(id, msg, progressElementId, percent) {
    const miniLog = document.getElementById(id);
    const pb = document.getElementById(progressElementId);
    if(miniLog) miniLog.innerText = msg;
    if(pb && percent !== undefined) pb.style.width = percent + '%';
}

window.toggleLog = () => document.getElementById('log-panel').classList.toggle('open');

window.updateProfileSkin = (username) => {
    const icon = document.getElementById('user-profile-icon');
    if(icon) icon.innerHTML = username ? `<img src="https://minotar.net/helm/${username}/50.png" style="width: 100%; height: 100%; object-fit: cover;">` : `👤`;
};

window.checkLogin = () => {
    if (!localStorage.getItem('user')) {
        alert("กรุณาล็อคอินก่อนใช้งานครับวัยรุ่น! 🔒");
        return false;
    }
    return true;
};

window.goPage = (id) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');

    const mainContent = document.querySelector('.main-content');
    
    if (id === 'page-login') {
        const loginBg = launcherSettings.login_bg || "https://images.hdqwalls.com/download/minecraft-caves-and-cliffs-4k-7j-1920x1080.jpg";
        mainContent.style.backgroundImage = `linear-gradient(to bottom, rgba(18,18,18,0.3) 0%, rgba(18,18,18,1) 100%), url('${loginBg}')`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
    } else if (id === 'page-welcome') {
        const welcomeBg = launcherSettings.welcome_bg || "https://images.hdqwalls.com/download/minecraft-caves-and-cliffs-4k-7j-1920x1080.jpg";
        mainContent.style.backgroundImage = `linear-gradient(to bottom, rgba(18,18,18,0.6) 0%, rgba(18,18,18,0.95) 100%), url('${welcomeBg}')`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
    } else if (id === 'page-versions') {
        const dlBg = launcherSettings.download_bg || "https://images.hdqwalls.com/download/minecraft-ocean-4k-2021-3p-1920x1080.jpg";
        mainContent.style.backgroundImage = `linear-gradient(to bottom, rgba(18,18,18,0.6) 0%, rgba(18,18,18,1) 100%), url('${dlBg}')`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
        
        setTimeout(() => {
            const nameInput = document.getElementById('custom-pack-name');
            if (nameInput) {
                nameInput.disabled = true;
                void nameInput.offsetHeight; 
                nameInput.disabled = false;
                nameInput.focus();
                nameInput.click(); 
            }
        }, 450); 
    } else if (id === 'page-modrinth') {
        // 🟢 [NONG SUM] เพิ่มพื้นหลังให้หน้า Modrinth สุดเท่! (ดึงจาก Dropbox)
        const modrinthBg = launcherSettings.modrinth_bg || "https://images.hdqwalls.com/download/minecraft-dungeons-4k-game-2r-1920x1080.jpg"; 
        mainContent.style.backgroundImage = `linear-gradient(to bottom, rgba(18,18,18,0.7) 0%, rgba(18,18,18,1) 100%), url('${modrinthBg}')`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
    } else {
        // ถ้าเป็นหน้าอื่นๆ (เช่น หน้าเตรียมรันเกม) ให้ใช้พื้นหลังสีเข้มๆ แบบเดิม
        mainContent.style.backgroundImage = 'radial-gradient(circle at top right, #1e293b 0%, #121212 60%)';
    }
};

// 🟢 [NONG SUM PATCH] ดักจับการ์ดเบิ้ล ไม่ให้โชว์ซ้อนตอนกำลังโหลด!
window.showWelcomePage = (username) => {
    const title = document.getElementById('welcome-title');
    if (title) title.innerText = `WELCOME, ${username.toUpperCase()}! 💎`;
    
    const grid = document.getElementById('welcome-pack-grid');
    if (grid) {
        grid.innerHTML = ''; 
        
        if (window.isInstalling && window.activeDownloadInfo) {
            window.showDownloadingCard(window.activeDownloadInfo.name, window.activeDownloadInfo.icon);
            const homeBar = document.getElementById('home-dl-progress');
            const homeTxt = document.getElementById('home-dl-text');
            if (homeBar) homeBar.style.width = `${window.activeDownloadInfo.percent}%`;
            if (homeTxt) homeTxt.innerText = window.activeDownloadInfo.text;
        }
        
        Object.keys(modpacks).forEach(id => {
            const pack = modpacks[id];
            grid.appendChild(createWelcomeCard(id, pack, true));
        });

        if (fs.existsSync(baseDir)) {
            fs.readdirSync(baseDir).forEach(folder => {
                if (folder.startsWith('custom-') && !modpacks[folder]) {
                    // 🛑 ดักทางซ้ำซ้อน: ถ้าโฟลเดอร์นี้คือตัวที่กำลังโหลดอยู่ ห้ามสร้างการ์ดปกติ!
                    if (window.isInstalling && window.activeDownloadInfo) {
                        const safeName = window.activeDownloadInfo.name.replace(/[^a-zA-Z0-9]/g, '_');
                        if (folder.includes(safeName)) return; // ข้ามไปเลย
                    }

                    const p = folder.split('-');
                    const mcVer = p[1];
                    const loader = p[2];
                    
                    // 🟢 [NONG SUM PATCH] แปลงขีดล่าง (_) กลับเป็นช่องว่าง (Space) และยุบตัวที่ซ้ำกันทิ้ง!
                    const rawName = p.slice(3).join('-');
                    const cleanName = rawName.replace(/_+/g, ' ').trim() || `MC ${mcVer}`; 
                    
                    let localIcon = "📦";
                    const iconPath = path.join(baseDir, folder, 'icon.png');
                    if (fs.existsSync(iconPath)) localIcon = `file:///${iconPath.replace(/\\/g, '/')}`;

                    const localPack = { 
                        name: cleanName.toUpperCase(), // โชว์ชื่อที่ล้างขยะออกแล้ว!
                        icon: localIcon, version: mcVer, loaderType: loader.toUpperCase(), isLocal: true 
                    };
                    grid.appendChild(createWelcomeCard(folder, localPack, false));
                }
            });
        }
    }
    window.goPage('page-welcome');
};

// 🟢 [NONG SUM PATCH] ฟังก์ชันสร้างการ์ดแพ็คแบบใหม่ สวยงามขึ้น มีเอฟเฟกต์ และรองรับทั้งไอคอนจากเน็ตและในเครื่อง!
function createWelcomeCard(id, data, isCloud) {
    const card = document.createElement('div');
    card.style.background = 'rgba(26,26,26,0.8)';
    card.style.backdropFilter = 'blur(10px)';
    card.style.borderRadius = '16px';
    card.style.padding = '20px';
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.3s ease';
    card.style.border = '2px solid #333';
    card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    
    card.onmouseover = () => { 
        card.style.transform = 'translateY(-10px)'; 
        card.style.borderColor = '#00ff88'; 
        card.style.boxShadow = '0 15px 30px rgba(0, 255, 136, 0.2)';
    };
    card.onmouseout = () => { 
        card.style.transform = 'translateY(0)'; 
        card.style.borderColor = '#333'; 
        card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
    };
    
    card.onclick = () => isCloud ? window.selectPack(id) : window.selectLocalPack(id, data);

    // 🟢 รองรับรูปลิงก์จากเน็ต (http) และรูปจากในเครื่อง (file:///)
    let iconHtml = (data.icon && (data.icon.startsWith('http') || data.icon.startsWith('file:///'))) 
        ? `<img src="${data.icon}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 16px; margin-bottom: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">` 
        : `<div style="font-size: 60px; margin-bottom: 15px; filter: drop-shadow(0 5px 5px rgba(0,0,0,0.5));">${data.icon || "🎮"}</div>`;

    card.innerHTML = `
        ${iconHtml}
        <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #fff; text-shadow: 1px 1px 2px black;">${data.name}</h3>
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: ${isCloud ? '#3b82f6' : '#a855f7'}; text-shadow: 1px 1px 2px black;">
            ${isCloud ? '☁️ CLOUD PACK' : '💻 LOCAL INSTALL'}
        </p>
        <div style="background: rgba(0,0,0,0.5); padding: 5px 12px; border-radius: 20px; border: 1px solid #444;">
            <p style="margin: 0; font-size: 12px; color: #00ff88; font-weight: bold;">MC ${data.version} | ${data.loaderType || (data.fabric ? 'FABRIC' : 'FORGE')}</p>
        </div>
    `;
    return card;
}

// 🟢 [NONG SUM PATCH] ระบบล็อคปุ่มกันวัยรุ่นใจร้อน
// 🟢 [NONG SUM PATCH] ระบบล็อคปุ่ม + ระบบความจำ!
window.isInstalling = false; 
window.isLaunching = false; // 🔒 กันเปิดเกม 2 จอ
window.activeDownloadInfo = null; // 🧠 ความจำ: เก็บข้อมูลมอดที่กำลังโหลด

window.selectPack = (id) => {
    
    selectedPack = id;
    const pack = modpacks[id];
    const nameEl = document.getElementById('current-pack-name');
    const verEl = document.getElementById('pack-version-display');
    if(nameEl) nameEl.innerText = pack.name;
    if(verEl) verEl.innerText = `MC ${pack.version} | ${pack.fabric ? 'Fabric' : 'Forge'}`;
    
    const mainContent = document.querySelector('.main-content');
    if (pack.bg) {
        mainContent.style.backgroundImage = `linear-gradient(to right, rgba(18,18,18,1) 0%, rgba(18,18,18,0.7) 40%, rgba(18,18,18,0.3) 100%), url('${pack.bg}')`;
        mainContent.style.backgroundSize = 'cover';
        mainContent.style.backgroundPosition = 'center';
    } else {
        mainContent.style.backgroundImage = 'radial-gradient(circle at top right, #1e293b 0%, #121212 60%)';
    }

    const btn = document.getElementById('btn-action');
    if(btn) { btn.innerText = "▶ LAUNCH"; btn.onclick = window.launchCloudGame; }
    window.goPage('page-launch');
};

window.selectLocalPack = (id, data) => {
    
    selectedPack = id;
    const nameEl = document.getElementById('current-pack-name');
    const verEl = document.getElementById('pack-version-display');
    if(nameEl) nameEl.innerText = data.name;
    if(verEl) verEl.innerText = `Local Install | MC ${data.version} | ${data.loaderType}`;

    const mainContent = document.querySelector('.main-content');
    mainContent.style.backgroundImage = 'radial-gradient(circle at top right, #2d3748 0%, #121212 60%)';

    const btn = document.getElementById('btn-action');
    if(btn) { btn.innerText = "▶ PLAY LOCAL"; btn.onclick = () => window.launchLocalGame(id, data); }
    window.goPage('page-launch');
};

// ==============================================================================

function downloadFileWithProgress(url, dest, miniLogId, pbId) {
    return new Promise(async (resolve, reject) => {
        try {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            const response = await axios({ 
                method: 'GET', url: url, responseType: 'arraybuffer',
                onDownloadProgress: (progressEvent) => {
                    if(progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setMiniLog(miniLogId, `กำลังโหลด: ${percent}%`, pbId, percent);
                    }
                }
            });
            fs.writeFileSync(dest, Buffer.from(response.data));
            if (fs.statSync(dest).size < 1000) throw new Error("ไฟล์เสีย หรือโหลดหน้าเว็บมาแทน");
            resolve();
        } catch (e) { reject(e); }
    });
}

// ==============================================================================
// ☕ ระบบ Java: บังคับใช้ Java 8u312 สำหรับ 1.16.5 แบบเด็ดขาด!!
// ==============================================================================
const runtimesDir = path.join(baseDir, "runtimes");
const javaLinks = {
    "8": "https://cdn.azul.com/zulu/bin/zulu8.58.0.13-ca-jre8.0.312-win_x64.zip",
    "16": "https://cdn.azul.com/zulu/bin/zulu16.32.15-ca-jre16.0.2-win_x64.zip", // เพิ่ม Java 16 สำหรับ 1.17.x
    "17": "https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.11-win_x64.zip",
    "21": "https://cdn.azul.com/zulu/bin/zulu21.34.19-ca-jre21.0.3-win_x64.zip"
};

async function getJavaPath(mcVersion) {
    const javaChoice = document.getElementById('java-select').value;
    let targetJava = javaChoice;
    const minorVer = parseInt(mcVersion.split('.')[1] || "0", 10);

    if (javaChoice === "auto") {
        if (minorVer >= 21 || mcVersion === "1.20.5" || mcVersion === "1.20.6") targetJava = "21";
        else if (minorVer >= 18) targetJava = "17"; 
        else if (minorVer === 17) targetJava = "16"; // 🛑 1.17 ต้องใช้ Java 16
        else targetJava = "8";
    } else if (javaChoice === "system") {
        return "java"; 
    }

    // 🛑 กฎเหล็กพิทักษ์เกม! ป้องกันคนเลือกผิด
    if (minorVer <= 16 && targetJava !== "8") {
        window.addLog(`⚠️ 1.16.5 ลงไป บังคับใช้ Java 8 รุ่นพิเศษเท่านั้น!`, "error");
        targetJava = "8";
    } else if (minorVer === 17 && targetJava !== "16") {
        window.addLog(`⚠️ 1.17.x บังคับใช้ Java 16 เท่านั้น!`, "error");
        targetJava = "16";
    } else if (minorVer >= 18 && (targetJava === "8" || targetJava === "16")) {
        targetJava = "17";
    }

    // 🔥 บังคับเปลี่ยนชื่อโฟลเดอร์ เพื่อให้มันดาวน์โหลดใหม่ 100% ล้างบางของเก่า!
    const folderName = `zulu_jre_v7_${targetJava}`; 
    // ... (โค้ดส่วนที่เหลือในฟังก์ชันปล่อยไว้เหมือนเดิม)
    const javaDir = path.join(runtimesDir, folderName);
    
    const findJavaExe = (dir) => {
        if (!fs.existsSync(dir)) return null;
        if (fs.existsSync(path.join(dir, "bin", "java.exe"))) return path.join(dir, "bin", "java.exe");
        const subDirs = fs.readdirSync(dir);
        for (let sub of subDirs) {
            const subPath = path.join(dir, sub, "bin", "java.exe");
            if (fs.existsSync(subPath)) return subPath;
        }
        return null;
    };

    let existingExe = findJavaExe(javaDir);
    if (existingExe) return existingExe;

    window.addLog(`☕ กำลังดาวน์โหลด Java ${targetJava} รุ่นอมตะ...`, "info");
    setMiniLog('update-mini-log', `กำลังดาวน์โหลด Java ${targetJava}...`, 'update-progress', 0);
    
    if (!fs.existsSync(runtimesDir)) fs.mkdirSync(runtimesDir, { recursive: true });
    const zipDest = path.join(runtimesDir, `${folderName}.zip`);

    await downloadFileWithProgress(javaLinks[targetJava], zipDest, 'update-mini-log', 'update-progress');
    
    setMiniLog('update-mini-log', `กำลังติดตั้ง Java...`, 'update-progress', 100);
    fs.mkdirSync(javaDir, { recursive: true });
    
    try { 
        await require('extract-zip')(zipDest, { dir: javaDir }); 
        if(fs.existsSync(zipDest)) fs.unlinkSync(zipDest); 
        
        let newExe = findJavaExe(javaDir);
        if (newExe) {
            window.addLog(`✅ ติดตั้ง Java ${targetJava} สำเร็จ!`, "success");
            return newExe;
        } else { throw new Error("หาไฟล์ java.exe ไม่เจอ"); }
    } catch (ex) { throw new Error("ติดตั้ง Java พัง: " + ex.message); }
}

// ==============================================================================
// 🛠️ เครื่องมือช่วยโหลดไฟล์
// ==============================================================================
const forceDownloadLib = async (url, gamePath, relativePath) => {
    const absolutePath = path.join(gamePath, 'libraries', relativePath.replace(/\//g, path.sep));
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).size < 100) {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        window.addLog(`📥 บังคับโหลดไฟล์ที่หายไป: ${path.basename(absolutePath)}...`, "info");
        try {
            const res = await axios({ method: 'GET', url: url, responseType: 'arraybuffer' });
            fs.writeFileSync(absolutePath, Buffer.from(res.data));
        } catch (e) { console.error("โหลดพลาด:", url, e.message); }
    }
};

// ==============================================================================
// 🛠️ [NONG SUM PATCH 1.17] ซ่อมไฟล์ SecureJarHandler ของ Forge 1.17.1
// ==============================================================================
async function patchForge117(gamePath, customName) {
    if (!customName || !customName.toLowerCase().includes("forge")) return;
    try {
        const jsonPath = path.join(gamePath, 'versions', customName, `${customName}.json`);
        if (!fs.existsSync(jsonPath)) return;
        let packData = JSON.parse(fs.readFileSync(jsonPath));
        let modified = false;

        let sjh = packData.libraries.find(l => l.name && l.name.startsWith("cpw.mods:securejarhandler"));
        if (sjh && !sjh.name.includes("0.9.54")) {
            packData.libraries = packData.libraries.filter(l => !(l.name && l.name.startsWith("cpw.mods:securejarhandler")));
            packData.libraries.push({
                name: "cpw.mods:securejarhandler:0.9.54",
                downloads: { artifact: { path: "cpw/mods/securejarhandler/0.9.54/securejarhandler-0.9.54.jar", url: "https://maven.minecraftforge.net/cpw/mods/securejarhandler/0.9.54/securejarhandler-0.9.54.jar" } }
            });
            await forceDownloadLib("https://maven.minecraftforge.net/cpw/mods/securejarhandler/0.9.54/securejarhandler-0.9.54.jar", gamePath, "cpw/mods/securejarhandler/0.9.54/securejarhandler-0.9.54.jar");
            modified = true;
        }

        let hasOldAsm = packData.libraries.some(l => l.name && l.name.startsWith("org.ow2.asm:asm:") && !l.name.includes("9.7"));
        if (hasOldAsm) {
            packData.libraries = packData.libraries.filter(l => !(l.name && l.name.startsWith("org.ow2.asm:")));
            const asmLibs = ['asm', 'asm-commons', 'asm-tree', 'asm-util', 'asm-analysis'];
            for (const lib of asmLibs) {
                const jarPath = `org/ow2/asm/${lib}/9.7/${lib}-9.7.jar`;
                const url = `https://repo1.maven.org/maven2/${jarPath}`;
                packData.libraries.push({
                    name: `org.ow2.asm:${lib}:9.7`,
                    downloads: { artifact: { path: jarPath, url: url } }
                });
                await forceDownloadLib(url, gamePath, jarPath);
            }
            modified = true;
        }

        if (packData.arguments && packData.arguments.jvm) {
            packData.arguments.jvm = packData.arguments.jvm.map(arg => {
                const replaceStr = (s) => s.replace(/securejarhandler-0\.9\.4[0-9]\.jar/g, 'securejarhandler-0.9.54.jar')
                                           .replace(/securejarhandler\/0\.9\.4[0-9]\//g, 'securejarhandler/0.9.54/')
                                           .replace(/asm(-[a-z]+)?-9\.[0-5]\.jar/g, 'asm$1-9.7.jar')
                                           .replace(/asm(-[a-z]+)?\/9\.[0-5]\//g, 'asm$1/9.7/');
                if (typeof arg === 'string') return replaceStr(arg);
                if (typeof arg === 'object' && arg.value) {
                    if (Array.isArray(arg.value)) arg.value = arg.value.map(v => typeof v === 'string' ? replaceStr(v) : v);
                    else if (typeof arg.value === 'string') arg.value = replaceStr(arg.value);
                }
                return arg;
            });
            modified = true;
        }

        if (modified) fs.writeFileSync(jsonPath, JSON.stringify(packData, null, 2));
    } catch(e) { console.error("Patch Error 1.17:", e); }
}

// ==============================================================================
// 🛠️ [NONG SUM PATCH 1.21] เติมไฟล์ให้ NeoForge (อัปเกรดแผนเนียน 100%)
// ==============================================================================
async function patchNeoForge121(gamePath, customName) {
    if (!customName || !customName.toLowerCase().includes("neoforge")) return;
    try {
        const jsonPath = path.join(gamePath, 'versions', customName, `${customName}.json`);
        if (!fs.existsSync(jsonPath)) return;
        let packData = JSON.parse(fs.readFileSync(jsonPath));
        let modified = false;

        if (packData.libraries) {
            // 1. ซ่อม URL ของไลบรารี่ที่หายไป
            for (let lib of packData.libraries) {
                if (lib.name && (!lib.downloads || !lib.downloads.artifact || !lib.downloads.artifact.url)) {
                    const parts = lib.name.split(':');
                    if (parts.length >= 3) {
                        const pkg = parts[0].replace(/\./g, '/');
                        const name = parts[1];
                        const ver = parts[2];
                        const jarPath = `${pkg}/${name}/${ver}/${name}-${ver}.jar`;
                        let baseUrl = "https://maven.neoforged.net/releases/";
                        if (parts[0] === "org.ow2.asm") baseUrl = "https://repo1.maven.org/maven2/";
                        else if (parts[0] === "net.minecraftforge") baseUrl = "https://maven.minecraftforge.net/";
                        else if (lib.url) baseUrl = lib.url;

                        if (!baseUrl.endsWith('/')) baseUrl += '/';
                        
                        lib.downloads = { artifact: { path: jarPath, url: baseUrl + jarPath } };
                        modified = true;
                        await forceDownloadLib(baseUrl + jarPath, gamePath, jarPath);
                    }
                }
            }
            
            // 2. แผนฉีดไฟล์ client.jar เข้า Library (NONG SUM UPDATE)
            const mcVer = packData.inheritsFrom || "1.21.1";
            const librariesPath = path.join(gamePath, 'libraries', 'com', 'mojang', 'minecraft', mcVer);
            const clientJarPath = path.join(librariesPath, `minecraft-${mcVer}-client.jar`);

            if (!fs.existsSync(clientJarPath)) {
                const sourceJar = path.join(baseDir, 'versions', mcVer, `${mcVer}.jar`);
                if (fs.existsSync(sourceJar)) {
                    fs.mkdirSync(librariesPath, { recursive: true });
                    fs.copyFileSync(sourceJar, clientJarPath);
                    window.addLog(`💉 ฉีดไฟล์ client.jar เข้า Library สำเร็จ!`, "success");
                }
            }

            const clientName = `com.mojang:minecraft-client:${mcVer}`;
            if (!packData.libraries.some(l => l.name === clientName)) {
                packData.libraries.push({
                    name: clientName,
                    downloads: { 
                        artifact: { 
                            path: `com/mojang/minecraft/${mcVer}/minecraft-${mcVer}-client.jar`, 
                            url: `https://maven.neoforged.net/releases/com/mojang/minecraft/${mcVer}/minecraft-${mcVer}-client.jar`
                        } 
                    }
                });
                modified = true;
            }
        } // ปิด if (packData.libraries)

        if (modified) {
            fs.writeFileSync(jsonPath, JSON.stringify(packData, null, 2));
        }
    } catch (e) {
        console.error("NeoForge Patch Error:", e);
    }
} // <--- ปิดฟังก์ชันให้เรียบร้อย!

// ==============================================================================
// 🎯 ฟังก์ชันโหลดเกมหลัก
// ==============================================================================
window.launchCloudGame = async () => {
    const javaInp = document.getElementById('java-select');
    if (javaInp) localStorage.setItem('java_choice', javaInp.value);
    const pack = modpacks[selectedPack];
    const ramInp = document.getElementById('ram-input');
    const ram = ramInp ? ramInp.value : 4;
    localStorage.setItem('ram', ram);

    const gamePath = path.join(baseDir, selectedPack);
    const localVersionPath = path.join(gamePath, "local_version.txt");
    const btn = document.getElementById('btn-action');
    if(btn) btn.disabled = true;

    try {
        setMiniLog('update-mini-log', "กำลังเช็คอัปเดต...", 'update-progress', 0);
        const response = await axios.get(pack.version_url);
        const { latest_version, zip_url } = response.data;

        if (!fs.existsSync(localVersionPath) || fs.readFileSync(localVersionPath, 'utf8') !== latest_version) {
            setMiniLog('update-mini-log', "กำลังลบมอดและคอนฟิกเก่าทิ้ง...", 'update-progress', 0);
            if (fs.existsSync(path.join(gamePath, 'mods'))) fs.rmSync(path.join(gamePath, 'mods'), { recursive: true, force: true });
            if (fs.existsSync(path.join(gamePath, 'config'))) fs.rmSync(path.join(gamePath, 'config'), { recursive: true, force: true });

            const zipDest = path.join(baseDir, 'temp.zip');
            window.addLog(`เริ่มดาวน์โหลด V.${latest_version}...`);
            await downloadFileWithProgress(zip_url, zipDest, 'update-mini-log', 'update-progress');
            setMiniLog('update-mini-log', "กำลังแตกไฟล์...", 'update-progress', 100);
            
            try { await require('extract-zip')(zipDest, { dir: gamePath }); } 
            catch (ex) { throw new Error("แตกไฟล์ ZIP พัง: " + ex.message); }

            if (fs.existsSync(zipDest)) fs.unlinkSync(zipDest);
            if (!fs.existsSync(gamePath)) fs.mkdirSync(gamePath, { recursive: true });
            fs.writeFileSync(localVersionPath, latest_version);
        }

        // 🟢 [NONG SUM PATCH] ปลดล็อค Cloud Pack ให้รองรับครบทุก Loader!
        let customLoader = undefined;
        let loaderType = "vanilla";
        let loaderVer = "";

        // เช็คว่าตั้งค่ามอดแพ็คบน Cloud เป็นค่ายไหน (จากไฟล์ modpacks.json)
        if (pack.fabric) { loaderType = "fabric"; loaderVer = pack.fabric; customLoader = `fabric-loader-${pack.fabric}-${pack.version}`; }
        else if (pack.forge) { loaderType = "forge"; loaderVer = pack.forge; }
        else if (pack.neoforge) { loaderType = "neoforge"; loaderVer = pack.neoforge; }
        else if (pack.quilt) { loaderType = "quilt"; loaderVer = pack.quilt; }

        if (loaderType !== "vanilla") {
            const versionsPath = path.join(gamePath, 'versions');
            let isLoaderInstalled = false;
            
            // เช็คก่อนว่าเคยติดตั้ง Loader ไว้แล้วหรือยัง
            if (fs.existsSync(versionsPath)) {
                const folders = fs.readdirSync(versionsPath);
                if (folders.some(f => f !== pack.version && fs.lstatSync(path.join(versionsPath, f)).isDirectory())) {
                    isLoaderInstalled = true;
                }
            }

            // ถ้ายังไม่เคยติดตั้ง สั่งหุ่นยนต์ลงมือด่วน!
            if (!isLoaderInstalled) {
                window.addLog(`☁️ กำลังติดตั้ง ${loaderType.toUpperCase()} ให้กับมอดแพ็คบน Cloud...`, "info");
                setMiniLog('update-mini-log', `กำลังติดตั้ง ${loaderType.toUpperCase()}...`, 'update-progress', 50);
                await window.installLoaderSilently(gamePath, loaderType, pack.version, loaderVer);
            }
        }
        
        runMinecraftCore(gamePath, pack.version, customLoader, ram);
    } catch (e) {
        window.addLog("Error: " + e.message, 'error');
        setMiniLog('update-mini-log', "เกิดข้อผิดพลาดในการรันเกม", 'update-progress', 0);
        if(btn) { btn.disabled = false; btn.innerText = "▶ LAUNCH"; }
    }
};

window.launchLocalGame = async (id, data) => {
    const javaInp = document.getElementById('java-select');
    if (javaInp) localStorage.setItem('java_choice', javaInp.value);
    const ramInp = document.getElementById('ram-input');
    const ram = ramInp ? ramInp.value : 4;
    localStorage.setItem('ram', ram);
    runMinecraftCore(path.join(baseDir, id), data.version, undefined, ram);
};

async function runMinecraftCore(gamePath, version, custom, ram) {
    const btn = document.getElementById('btn-action');
    if(btn) { btn.innerText = "LAUNCHING..."; btn.disabled = true; }
    setMiniLog('update-mini-log', "ทะยานเข้าสู่เกม...", 'update-progress', 100);

    if (!custom) {
        const versionsPath = path.join(gamePath, 'versions');
        if (fs.existsSync(versionsPath)) {
            const folders = fs.readdirSync(versionsPath);
            const customFolder = folders.find(f => f !== version && fs.lstatSync(path.join(versionsPath, f)).isDirectory());
            if (customFolder) custom = customFolder;
        }
    }

    const minorVer = parseInt(version.split('.')[1] || "0", 10);
    
    // 🔥 แจกจ่ายงานให้แพทช์แยกตามเวอร์ชัน (ไม่ตบตีกันแน่นอน)
    if (minorVer === 17) {
        await patchForge117(gamePath, custom);
    } else if (minorVer >= 21) {
        await patchNeoForge121(gamePath, custom); 
    }
    
    const { Authenticator } = require('minecraft-launcher-core');
    let authObj;
    
    if (localStorage.getItem('ms_auth')) {
        // 🔥 ดึงเวลาที่ล็อคอินล่าสุดมาเช็ค
        let authTime = parseInt(localStorage.getItem('ms_auth_time') || "0");
        let hoursPassed = (Date.now() - authTime) / (1000 * 60 * 60);

        // ถ้าเวลาผ่านไปเกิน 20 ชั่วโมง (เผื่อเหลือเผื่อขาดก่อนครบ 24 ชม.) ให้รีเฟรชใหม่!
        if (hoursPassed > 20) {
            window.addLog("🔄 ตั๋วไอดีแท้หมดอายุ! กำลังต่ออายุอัตโนมัติแบบลับๆ...", "info");
            try {
                const freshAuth = await ipcRenderer.invoke('ms-login'); // เรียกขอ Token ใหม่
                if (freshAuth) {
                    localStorage.setItem('ms_auth', JSON.stringify(freshAuth));
                    localStorage.setItem('ms_auth_time', Date.now().toString());
                    authObj = freshAuth;
                    window.addLog("✅ ต่ออายุสำเร็จ! ลุยเซิร์ฟแท้ได้เลย", "success");
                } else {
                    throw new Error("ดึงตั๋วใหม่ไม่สำเร็จ");
                }
            } catch (e) {
                window.addLog("❌ ต่ออายุอัตโนมัติล้มเหลว กรุณากดปุ่ม Logout แล้ว Login ใหม่ครับ", "error");
                if(btn) { btn.innerText = "▶ LAUNCH"; btn.disabled = false; }
                return; // เบรคการรันเกมทันที ป้องกันเกมพัง
            }
        } else {
            // ถ้ายังไม่หมดอายุ ก็ใช้ของเดิมไปเลย
            authObj = JSON.parse(localStorage.getItem('ms_auth'));
        }
    } else {
        // สำหรับสายเล่นออฟไลน์
        authObj = Authenticator.getAuth(localStorage.getItem('user') || "Player");
    }

    let targetJavaPath = "java";
    try {
        targetJavaPath = await getJavaPath(version);
    } catch (err) {
        window.addLog(`❌ โหลด Java ไม่สำเร็จ: ${err.message}`, "error");
    }

    let launchOptions = {
        authorization: authObj, root: gamePath, javaPath: targetJavaPath,
        version: { number: version, type: "release", custom: custom }, memory: { max: ram + "G", min: "1G" }
    };

    let jvmFixArgs = [];
    
    // 🚀 [ตำนาน V14 คืนชีพ!] บังคับดึงคำสั่ง Module Path ให้ 1.17 และ 1.21+ (กัน MCLC ลืม)
    if (minorVer >= 17 && custom && (custom.toLowerCase().includes("neoforge") || custom.toLowerCase().includes("forge"))) {
        try {
            const jsonPath = path.join(gamePath, 'versions', custom, `${custom}.json`);
            if (fs.existsSync(jsonPath)) {
                const packData = JSON.parse(fs.readFileSync(jsonPath));
                if (packData.arguments && packData.arguments.jvm) {
                    const processArg = (str) => {
                        let res = str.replace(/\$\{library_directory\}/g, path.join(gamePath, 'libraries'));
                        res = res.replace(/\$\{classpath_separator\}/g, require('path').delimiter);
                        res = res.replace(/\$\{version_name\}/g, custom);
                        return res;
                    };

                    packData.arguments.jvm.forEach(arg => {
                        if (typeof arg === 'string') {
                            let processed = processArg(arg);
                            // 🛑 [Nong Sum]: สำหรับ 1.21+ ห้าม Ignore ไฟล์ client-extra เด็ดขาด!
                            if (minorVer >= 21 && processed.includes("-DignoreList=")) {
                                processed = processed.replace('client-extra,', '').replace(',client-extra', '').replace('client-extra', '');
                            }
                            if (!processed.includes('${classpath}')) jvmFixArgs.push(processed);
                        } else if (typeof arg === 'object' && arg.value) {
                            const processValue = (v) => {
                                if (typeof v !== 'string' || v.includes('${classpath}')) return null;
                                let p = processArg(v);
                                if (minorVer >= 21 && p.includes("-DignoreList=")) {
                                    p = p.replace('client-extra,', '').replace(',client-extra', '').replace('client-extra', '');
                                }
                                return p;
                            };

                            if (Array.isArray(arg.value)) {
                                arg.value.forEach(v => {
                                    const finalV = processValue(v);
                                    if (finalV) jvmFixArgs.push(finalV);
                                });
                            } else {
                                const finalV = processValue(arg.value);
                                if (finalV) jvmFixArgs.push(finalV);
                            }
                        }
                    });
                    window.addLog(`🛠️ ดึงคำสั่งรันเกม ${custom} สำเร็จ!`, "success");
                }
            }
        } catch (e) { console.error("JVM Extraction Error:", e); }
    }

    // 🛑 [Nong Sum]: บล็อคการตรวจสอบสิทธิ์ Microsoft สำหรับสายเถื่อนใน 1.16.4 - 1.16.5
    if (!localStorage.getItem('ms_auth') && (version === "1.16.4" || version === "1.16.5")) {
        jvmFixArgs.push(
            "-Dminecraft.api.auth.host=https://nope.invalid",
            "-Dminecraft.api.account.host=https://nope.invalid",
            "-Dminecraft.api.session.host=https://nope.invalid",
            "-Dminecraft.api.services.host=https://nope.invalid"
        );
        window.addLog(`🛡️ เปิดโหมดทะลวงบล็อค Multiplayer สำหรับ 1.16.5 (Offline)`, "info");
    }

    // เพิ่มคำสั่งทะลวงกำแพง Java ให้เฉพาะเวอร์ชัน 1.17 ขึ้นไป 
    if (minorVer >= 17) {
        jvmFixArgs.push(
            "--add-opens=java.base/java.io=ALL-UNNAMED",
            "--add-opens=java.base/java.lang.invoke=ALL-UNNAMED",
            "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED",
            "--add-opens=java.base/java.lang=ALL-UNNAMED",
            "--add-opens=java.base/java.net=ALL-UNNAMED",
            "--add-opens=java.base/java.nio=ALL-UNNAMED",
            "--add-opens=java.base/java.util.concurrent=ALL-UNNAMED",
            "--add-opens=java.base/java.util.jar=ALL-UNNAMED",
            "--add-opens=java.base/java.util.regex=ALL-UNNAMED",
            "--add-opens=java.base/java.util.stream=ALL-UNNAMED",
            "--add-opens=java.base/java.util=ALL-UNNAMED",
            "--add-opens=java.base/java.text=ALL-UNNAMED",
            "--add-opens=java.base/sun.net.www.protocol.jar=ALL-UNNAMED",
            "--add-opens=java.desktop/sun.awt=ALL-UNNAMED",
            "--add-opens=java.base/sun.security.action=ALL-UNNAMED",
            "--add-opens=java.base/sun.security.util=ALL-UNNAMED",
            "--add-opens=java.base/sun.nio.fs=ALL-UNNAMED"
        );
    }



    // 🚀 เอาคำสั่งพิเศษทั้งหมดที่เตรียมไว้ ยัดใส่ตัวรันเกม
        if (jvmFixArgs.length > 0) {
            launchOptions.customArgs = jvmFixArgs;
        }

        // 🧠 [NONG SUM PATCH] แยกสมองเกม! สร้าง Launcher ตัวใหม่ 1 ตัวต่อ 1 จอเกม
        const { Client } = require('minecraft-launcher-core');
        const gameLauncher = new Client();
        
        gameLauncher.on('progress', (e) => {
            const p = Math.round((e.task / e.total) * 100);
            setMiniLog('update-mini-log', `กำลังรันเกม: ${p}%`, 'update-progress', p);
        });
        
        gameLauncher.on('close', () => { 
            window.addLog("ปิดเกมแล้ว"); 
            const btn = document.getElementById('btn-action');
            if(btn) { btn.disabled = false; btn.innerText = "▶ LAUNCH"; }
        });

        // 🎮 สั่งเปิดเกมของจริง!
        try {
            await gameLauncher.launch(launchOptions);
        } catch (e) {
            window.addLog(`❌ รันเกมล้มเหลว: ${e.message}`, "error");
            const btn = document.getElementById('btn-action');
            if(btn) { btn.innerText = "▶ LAUNCH"; btn.disabled = false; }
        }
    } // 👈 ปิดวงเล็บ runMinecraftCore

// ---------------------- 📥 ระบบดาวน์โหลด ----------------------
window.loadAllMCVersions = async () => {
    const selector = document.getElementById('mc-version-select');
    if (!selector) return; 
    try {
        const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        const versionsHtml = response.data.versions.filter(v => v.type === 'release').map(v => `<option value="${v.id}">${v.id}</option>`).join('');
        selector.innerHTML = versionsHtml;
        
        // 🟢 เติมเวอร์ชันเข้าไปในตัวกรอง Modrinth ด้วย!
        const mrVerSel = document.getElementById('mr-filter-ver');
        if (mrVerSel) mrVerSel.innerHTML = '<option value="all">🌍 ทุกเวอร์ชัน</option>' + versionsHtml;

        window.updateLoaderVersions();
    } catch (e) { window.addLog("ดึงเวอร์ชันล้มเหลว", "error"); }
};

window.updateLoaderVersions = async () => {
    const mcVersion = document.getElementById('mc-version-select').value;
    const type = document.getElementById('loader-type-select').value;
    const loaderSelect = document.getElementById('loader-version-select');
    if (!loaderSelect) return;

    if (type === 'vanilla') { loaderSelect.style.display = 'none'; return; }
    loaderSelect.style.display = 'block';
    loaderSelect.innerHTML = '<option>Loading...</option>';

    try {
        if (type === 'fabric') {
            const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
            loaderSelect.innerHTML = res.data.map(v => `<option value="${v.loader.version}">${v.loader.version}</option>`).join('');
        } else if (type === 'quilt') {
            const res = await axios.get(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
            loaderSelect.innerHTML = res.data.map(v => `<option value="${v.loader.version}">${v.loader.version}</option>`).join('');
        } else if (type === 'forge') {
            const res = await axios.get(`https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`);
            loaderSelect.innerHTML = res.data.map(v => `<option value="${v.version}">${v.version}</option>`).join('');
        } else if (type === 'neoforge') {
            const res = await axios.get(`https://bmclapi2.bangbang93.com/neoforge/list/${mcVersion}`);
            loaderSelect.innerHTML = res.data.map(v => `<option value="${v.version}">${v.version}</option>`).join('');
        }
    } catch (e) { loaderSelect.innerHTML = '<option value="latest">Not Found</option>'; }
};

window.installGame = async () => {
    window.addLog("▶ กดปุ่ม INSTALL แล้ว! กำลังเตรียมไฟล์มอด...");
    
    const version = document.getElementById('mc-version-select').value;
    const loader = document.getElementById('loader-type-select').value;
    const loaderVerEl = document.getElementById('loader-version-select');
    const loaderVer = loaderVerEl ? loaderVerEl.value : 'latest';
    
    const rawPackName = document.getElementById('custom-pack-name').value.trim();
    const btn = document.getElementById('btn-start-download');

    if (!version) return;
    if (!rawPackName) {
        alert("วัยรุ่น! ตั้งชื่อมอดแพ็คก่อนกดติดตั้งด้วยครับ 📝");
        document.getElementById('custom-pack-name').focus();
        return;
    }

    const safePackName = rawPackName.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_');
    if(btn) btn.disabled = true;
    
    const installPath = path.join(baseDir, `custom-${version}-${loader}-${safePackName}`);
    
    if (fs.existsSync(installPath)) {
        if (confirm(`พบมอดแพ็คชื่อ [${safePackName}] ค้างอยู่ในระบบ จะให้ลบทิ้งแล้วสร้างใหม่ไหม?`)) {
            try { fs.rmSync(installPath, { recursive: true, force: true }); } 
            catch(e) { 
                alert("ลบซากไฟล์เก่าไม่ได้ ปิดโปรแกรมแล้วเปิดใหม่ทีนึงนะ!"); 
                if(btn) btn.disabled = false;
                return; 
            }
        } else {
            if(btn) btn.disabled = false;
            return;
        }
    }
    
    fs.mkdirSync(installPath, { recursive: true });

    try {
        let installerPath = undefined;
        
        if (loader === 'fabric') {
            setMiniLog('dl-mini-log', `กำลังเตรียม Fabric...`, 'dl-progress', 50);
            const reqUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVer}/profile/json`;
            const res = await axios.get(reqUrl);
            const customName = res.data.id; 
            const dir = path.join(installPath, "versions", customName);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${customName}.json`), JSON.stringify(res.data));
            
        } else if (loader === 'quilt') {
            setMiniLog('dl-mini-log', `กำลังเตรียม Quilt...`, 'dl-progress', 50);
            const reqUrl = `https://meta.quiltmc.org/v3/versions/loader/${version}/${loaderVer}/profile/json`;
            const res = await axios.get(reqUrl);
            const customName = res.data.id; 
            const dir = path.join(installPath, "versions", customName);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${customName}.json`), JSON.stringify(res.data));
            
        } else if (loader === 'forge') {
            installerPath = path.join(installPath, `forge-installer.jar`);
            const forgeUrls = [
                `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${loaderVer}/forge-${version}-${loaderVer}-installer.jar`,
                `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${loaderVer}-${version}/forge-${version}-${loaderVer}-${version}-installer.jar`,
                `https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/${version}-${loaderVer}/forge-${version}-${loaderVer}-installer.jar`,
                `https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/${version}-${loaderVer}-${version}/forge-${version}-${loaderVer}-${version}-installer.jar`
            ];

            let downloaded = false;
            window.addLog(`กำลังหาโหลด Forge Installer...`);
            for (let fUrl of forgeUrls) {
                try {
                    setMiniLog('dl-mini-log', `กำลังโหลด Forge Installer...`, 'dl-progress', 50);
                    await downloadFileWithProgress(fUrl, installerPath, 'dl-mini-log', 'dl-progress');
                    
                    const buffer = fs.readFileSync(installerPath);
                    if (buffer.length > 50000 && buffer[0] === 0x50 && buffer[1] === 0x4B) { 
                        downloaded = true;
                        window.addLog(`✅ ดึง Forge สำเร็จ!`);
                        break; 
                    }
                } catch(e) { } 
            }

            if (!downloaded) throw new Error("ไม่สามารถดาวน์โหลดไฟล์ติดตั้ง Forge ได้");
            fs.writeFileSync(path.join(installPath, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));

        } else if (loader === 'neoforge') {
            installerPath = path.join(installPath, `neoforge-installer.jar`);
            const urls = [
                `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVer}/neoforge-${loaderVer}-installer.jar`,
                `https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/${loaderVer}/neoforge-${loaderVer}-installer.jar`
            ];

            let downloaded = false;
            for(let u of urls) {
                try {
                    setMiniLog('dl-mini-log', `กำลังโหลด NeoForge Installer...`, 'dl-progress', 50);
                    await downloadFileWithProgress(u, installerPath, 'dl-mini-log', 'dl-progress');
                    const buffer = fs.readFileSync(installerPath);
                    if (buffer.length > 50000 && buffer[0] === 0x50 && buffer[1] === 0x4B) { downloaded = true; break; }
                } catch(e){}
            }
            if (!downloaded) throw new Error("ไม่สามารถดาวน์โหลดไฟล์ติดตั้ง NeoForge ได้");
            fs.writeFileSync(path.join(installPath, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));
        }

        if (installerPath) {
            window.addLog("⏳ กำลังติดตั้งระบบมอดลงเครื่อง...");
            setMiniLog('dl-mini-log', `กำลังติดตั้งระบบมอด...`, 'dl-progress', 80);
            
            await new Promise((resolve, reject) => {
                let stderrLog = "";
                const child = spawn('java', ['-jar', installerPath, '--installClient', installPath]);
                
                child.stdout.on('data', (d) => console.log(`Installer: ${d.toString().trim()}`));
                child.stderr.on('data', (d) => {
                    const msg = d.toString().trim();
                    stderrLog += msg + "\n";
                });
                
                child.on('close', async (code) => {
                    if (code === 0) {
                        resolve(); 
                    } else if (stderrLog.includes("installClient is not a recognized option") || stderrLog.includes("UnrecognizedOptionException")) {
                        window.addLog("⚠️ งัดไฟล์ Forge รุ่นเก่า...", "info");
                        try {
                            const extractZip = require('extract-zip');
                            const tempDir = path.join(installPath, "temp_forge_installer");
                            await extractZip(installerPath, { dir: tempDir });
                            
                            const profilePath = path.join(tempDir, "install_profile.json");
                            if (fs.existsSync(profilePath)) {
                                const profileData = JSON.parse(fs.readFileSync(profilePath));
                                const versionInfo = profileData.versionInfo || profileData; 
                                const customName = versionInfo.id;
                                
                                if (versionInfo.libraries) {
                                    versionInfo.libraries.forEach(lib => {
                                        if (lib.url) {
                                            lib.url = lib.url.replace("http://", "https://");
                                            lib.url = lib.url.replace("files.minecraftforge.net/maven", "maven.minecraftforge.net");
                                        }
                                        if (!lib.downloads) {
                                            const parts = lib.name.split(':');
                                            const jarPath = `${parts[0].replace(/\./g, '/')}/${parts[1]}/${parts[2]}/${parts[1]}-${parts[2]}.jar`;
                                            const baseUrl = lib.url || "https://libraries.minecraft.net/";
                                            lib.downloads = { artifact: { path: jarPath, url: baseUrl.endsWith('/') ? baseUrl + jarPath : baseUrl + '/' + jarPath } };
                                        }
                                    });
                                }
                                
                                const targetVerDir = path.join(installPath, "versions", customName);
                                fs.mkdirSync(targetVerDir, { recursive: true });
                                fs.writeFileSync(path.join(targetVerDir, `${customName}.json`), JSON.stringify(versionInfo, null, 2));
                                
                                const forgeJar = fs.readdirSync(tempDir).find(f => f.endsWith('-universal.jar') || (f.startsWith('forge-') && f.endsWith('.jar')));
                                if (forgeJar) {
                                    const forgeLib = versionInfo.libraries.find(l => l.name && l.name.startsWith("net.minecraftforge:forge"));
                                    if (forgeLib) {
                                        const parts = forgeLib.name.split(':'); 
                                        const libDest = path.join(installPath, "libraries", parts[0].replace(/\./g, '/'), parts[1], parts[2], `${parts[1]}-${parts[2]}.jar`);
                                        fs.mkdirSync(path.dirname(libDest), { recursive: true });
                                        fs.copyFileSync(path.join(tempDir, forgeJar), libDest);
                                    }
                                }
                                
                                fs.rmSync(tempDir, { recursive: true, force: true });
                                window.addLog(`🛠️ งัดไฟล์สำเร็จ!`, "success");
                                resolve();
                            } else {
                                reject(new Error("งัดไฟล์ไม่สำเร็จ"));
                            }
                        } catch (ex) {
                            reject(new Error(`ทำงานพลาด: ${ex.message}`));
                        }
                    } else {
                        reject(new Error(`ติดตั้งล้มเหลว`));
                    }
                });
                
                child.on('error', () => reject(new Error(`ไม่พบ Java`)));
            });
        }

        window.addLog(`✅ สร้างมอดแพ็ค ${safePackName} สำเร็จ! ไปกด PLAY ได้เลย!`, "success");
        setMiniLog('dl-mini-log', `ติดตั้งสำเร็จ!`, 'dl-progress', 100);
        
        document.getElementById('custom-pack-name').value = '';
        if(btn) btn.disabled = false;
        
        window.showWelcomePage(localStorage.getItem('user') || "Player");

    } catch (err) {
        window.addLog(`❌ ข้อผิดพลาด: ${err.message}`, "error");
        setMiniLog('dl-mini-log', `ติดตั้งล้มเหลว ลบซากไฟล์แล้ว!`, 'dl-progress', 0);
        if (fs.existsSync(installPath)) {
            try { fs.rmSync(installPath, { recursive: true, force: true }); } catch(e) {}
        }
        if(btn) btn.disabled = false;
    }
};

window.deletePack = () => {
    if (!selectedPack) return;
    if (confirm(`คุณแน่ใจหรือไม่ว่าจะลบ [ ${selectedPack} ] ?\nไฟล์มอดและเซฟเกมทั้งหมดจะหายไปกู่ไม่กลับนะวัยรุ่น!`)) {
        const targetPath = path.join(baseDir, selectedPack);
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
            window.addLog(`🗑️ ลบมอดแพ็ค ${selectedPack} สำเร็จ!`, "success");
            selectedPack = null;
            window.showWelcomePage(localStorage.getItem('user') || 'PLAYER'); 
        } catch (e) {
            window.addLog(`❌ ลบไม่สำเร็จ: ${e.message}`, "error");
        }
    }
};

document.getElementById('btn-login').onclick = () => {
    const userInp = document.getElementById('username-input');
    if(!userInp || !userInp.value) return alert("ใส่ชื่อด้วย!");
    const user = userInp.value;
    localStorage.setItem('user', user); localStorage.removeItem('ms_auth');
    window.updateProfileSkin(user);
    window.showWelcomePage(user);
};

document.getElementById('btn-ms-login').onclick = async () => {
    try {
        const authConfig = await ipcRenderer.invoke('ms-login');
        if (!authConfig) return window.addLog("ยกเลิกการล็อคอิน", "error");
        
        localStorage.setItem('ms_auth', JSON.stringify(authConfig));
        localStorage.setItem('user', authConfig.name);
        
        // 🔥 [Nong Sum]: จด Timestamp (เวลาปัจจุบัน) เอาไว้เช็คอายุตั๋ว!
        localStorage.setItem('ms_auth_time', Date.now().toString()); 
        
        window.updateProfileSkin(authConfig.name);
        window.addLog(`ยินดีต้อนรับ ${authConfig.name} 💎`);
        window.showWelcomePage(authConfig.name);
    } catch (e) { window.addLog("Login Error", "error"); }
};

window.logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('ms_auth');
    const userInp = document.getElementById('username-input');
    if(userInp) userInp.value = "";
    window.updateProfileSkin(null);
    window.goPage('page-login');
};

async function installFabric(root, mc, fab) {
    const name = `fabric-loader-${fab}-${mc}`;
    const dir = path.join(root, "versions", name);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mc}/${fab}/profile/json`);
        fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(res.data));
    }
}

window.openFolder = (folderName) => {
    if (!selectedPack) return;
    const targetPath = path.join(baseDir, selectedPack, folderName);
    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
    shell.openPath(targetPath);
};

window.onload = async () => {
    const javaInp = document.getElementById('java-select');
    if (javaInp) javaInp.value = localStorage.getItem('java_choice') || "auto";
    const userInp = document.getElementById('username-input');
    const ramInp = document.getElementById('ram-input');
    const user = localStorage.getItem('user');

    if (user && userInp) {
        userInp.value = user;
        window.updateProfileSkin(user);
    }
    if (ramInp) ramInp.value = localStorage.getItem('ram') || 4;
    
    try {
        const response = await axios.get(MASTER_URL);
        if (response.data._settings) {
            launcherSettings = response.data._settings;
            delete response.data._settings; 
        }
        modpacks = response.data;
        await window.loadAllMCVersions(); 
    } catch (e) { window.addLog("โหลดคลาวด์ไม่สำเร็จ", "error"); }

    const loadingScreen = document.getElementById('loading-screen');

    if (user) {
        window.showWelcomePage(user); 
    } else {
        window.goPage('page-login'); 
    }

    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.style.display = 'none', 500);
        }, 800);
    }
};

launcher.on('progress', (e) => {
    const p = Math.round((e.task / e.total) * 100);
    if(document.getElementById('page-launch').classList.contains('active')){
        setMiniLog('update-mini-log', `เตรียมไฟล์เกม: ${p}%`, 'update-progress', p);
    }
});

launcher.on('debug', (e) => console.log("[MCLC Debug]:", e));
launcher.on('data', (e) => console.log("[GAME]:", e.toString().trim()));
launcher.on('data-stderr', (e) => {
    const errStr = e.toString().trim();
    console.error("[GAME ERR]:", errStr);
    if (errStr.toLowerCase().includes("error") || errStr.toLowerCase().includes("exception")) {
        window.addLog(`❌ [Java Error]: ${errStr}`, "error");
    }
});

launcher.on('close', () => { 
    window.addLog("ปิดเกมแล้ว"); 
    setMiniLog('update-mini-log', "พร้อมใช้งาน", 'update-progress', 0);
    const btn = document.getElementById('btn-action');
    if(btn) { btn.disabled = false; btn.innerText = "▶ LAUNCH"; }
});



// ==============================================================================
// 🔥 [NONG SUM PATCH] ระบบดึงข้อมูลจาก CURSEFORGE (อัปเกรดเกราะกันโดนบล็อค!)
// ==============================================================================
// ==============================================================================
// 🔥 [NONG SUM PATCH] ระบบดึงข้อมูลจาก CURSEFORGE (อัปเกรดเกราะกัน 403 ทุกจุด!)
// ==============================================================================
// ⚠️ ระวังตอนวาง API Key อย่าให้มี "ช่องว่าง" (Spacebar) แอบติดมาตรงหัวหรือท้ายนะ!
const CF_API_KEY = "$2a$10$g2HOq5TtnSUkYei./kiMLuEWwRbzwgo4edkinVM9mm7yO0XnR9D66"; 

// 🟢 สร้างตัวรวม Headers ส่งกุญแจแบบ VIP (ใช้ร่วมกันทุกฟังก์ชัน)
// 🟢 สร้างตัวรวม Config ส่งกุญแจแบบ VIP (ทะลวงบล็อคเบราว์เซอร์)
const CF_CONFIG = { 
    headers: {
        'x-api-key': CF_API_KEY.trim(),
        'Accept': 'application/json',
        'User-Agent': 'ThungsongLauncher/1.0'
    },
    adapter: 'http' // 👈 ไอเทมลับ! บังคับใช้โหมด Node.js หลังบ้าน ทะลวงบล็อค 100%
};

window.fetchCurseForgePacks = async (searchQuery = "", limit = 20, offset = 0) => {
    if (!CF_API_KEY || CF_API_KEY.includes("ใส่_API_KEY")) {
        alert("⚠️ วัยรุ่น! ลืมใส่ API Key ของ CurseForge รึเปล่า!");
        return [];
    }
    
    try {
        window.addLog(`🔥 กำลังค้นหา CurseForge... (หน้า ${Math.floor(offset/limit) + 1})`, "info");
        const verSel = document.getElementById('mr-filter-ver');
        const sortSel = document.getElementById('mr-filter-sort'); // 👈 ดึงค่าจัดเรียง
        
        const sortValue = sortSel ? sortSel.value : "downloads";
        let sortField = 6; // ค่ามาตรฐาน: 6 = เรียงตามยอดดาวน์โหลดสูงสุด (ความนิยม)
        
        if (sortValue === "relevance") sortField = 1; // 1 = ระบบเลือกให้ (Featured/Relevance)
        else if (sortValue === "updated") sortField = 3; // 3 = อัปเดตล่าสุด
        else if (sortValue === "newest") sortField = 3; 

        // 🎯 บังคับใส่ sortOrder=desc เพื่อให้ตัวท็อปๆ เด้งขึ้นมาก่อนเสมอ
        let url = `https://api.curseforge.com/v1/mods/search?gameId=432&classId=4471&pageSize=${limit}&index=${offset}&sortField=${sortField}&sortOrder=desc`;
        
        if (searchQuery.trim() !== "") url += `&searchFilter=${encodeURIComponent(searchQuery)}`;
        if (verSel && verSel.value !== "all") url += `&gameVersion=${verSel.value}`;

        const response = await axios.get(url, CF_CONFIG);
        const packs = response.data.data;

        if (!packs || packs.length === 0) return [];
        return packs.map(pack => ({
            id: pack.id, slug: pack.slug, name: pack.name,              
            author: pack.authors && pack.authors.length > 0 ? pack.authors[0].name : "Unknown", 
            description: pack.summary, 
            icon: pack.logo ? pack.logo.thumbnailUrl : "https://docs.modrinth.com/img/logo.svg", 
            downloads: pack.downloadCount, source: "curseforge", versions: [] 
        }));
    } catch (error) {
        const errMsg = error.response ? `[Error ${error.response.status}] ${JSON.stringify(error.response.data)}` : error.message;
        window.addLog(`❌ ดึงข้อมูล CurseForge ล้มเหลว: ${errMsg}`, "error");
        return [];
    }
};

// ==============================================================================
// 🟢 [NONG SUM PATCH] ระบบดึงข้อมูล Modpack จาก Modrinth API (แก้บัคเลือกเวอร์ชันไม่ได้!)
// ==============================================================================
let currentModrinthQuery = "";
let currentModrinthOffset = 0;
const MODRINTH_LIMIT = 20;

window.fetchModrinthPacks = async (searchQuery = "", limit = 20, offset = 0) => {
    try {
        window.addLog(`🔍 กำลังค้นหาข้อมูล Modrinth... (หน้า ${Math.floor(offset/limit) + 1})`, "info");
        
        const catSel = document.getElementById('mr-filter-category');
        const verSel = document.getElementById('mr-filter-ver');
        const loaderSel = document.getElementById('mr-filter-loader');
        const sortSel = document.getElementById('mr-filter-sort'); 
        
        const sortIndex = sortSel ? sortSel.value : "downloads";

        let facetsArray = [];
        facetsArray.push([`project_type:modpack`]);
        
        if (catSel && catSel.value !== "all") facetsArray.push([`categories:${catSel.value}`]);
        if (verSel && verSel.value !== "all") facetsArray.push([`versions:${verSel.value}`]);
        if (loaderSel && loaderSel.value !== "all") facetsArray.push([`categories:${loaderSel.value}`]);

        const facets = encodeURIComponent(JSON.stringify(facetsArray));
        const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&facets=${facets}&index=${sortIndex}&limit=${limit}&offset=${offset}`;
        
        const response = await axios.get(url);
        const packs = response.data.hits;

        if (!packs || packs.length === 0) return [];
        return packs.map(pack => ({
            id: pack.project_id, slug: pack.slug, name: pack.title,              
            author: pack.author, description: pack.description, 
            icon: pack.icon_url || "https://docs.modrinth.com/img/logo.svg", 
            downloads: pack.downloads, versions: pack.versions,
            source: "modrinth" // 👈 [NONG SUM PATCH] เติมป้ายค่ายตรงนี้! ป๊อปอัปจะได้ไม่งง!
        }));
    } catch (error) {
        window.addLog(`❌ ดึงข้อมูล Modrinth ล้มเหลว: ${error.message}`, "error");
        return [];
    }
};

// 🔒 กุญแจกันโหลดซ้อนตอนเลื่อนจอ

// ==============================================================================
// 🟢 [NONG SUM PATCH] ระบบค้นหาลูกผสม (Modrinth + CurseForge)
// ==============================================================================
window.isFetchingModrinth = false;

window.searchModrinth = async (query = null, isLoadMore = false) => {
    if (window.isFetchingModrinth) return; 
    window.isFetchingModrinth = true;

    const searchInp = document.getElementById('modrinth-search-input');
    const grid = document.getElementById('modrinth-grid');
    const loading = document.getElementById('modrinth-loading');
    
    // 🔍 เช็คว่ากำลังเปิดสวิตช์หาจากค่ายไหนอยู่
    const sourceSel = document.getElementById('mr-filter-source');
    const source = sourceSel ? sourceSel.value : "modrinth";

    if (!isLoadMore) {
        currentModrinthQuery = query !== null ? query : (searchInp ? searchInp.value : "");
        if (searchInp) searchInp.value = currentModrinthQuery;
        currentModrinthOffset = 0; 
        if (grid) grid.innerHTML = "";
    } else {
        currentModrinthOffset += 20; 
    }

    if (loading) loading.style.display = "block";

    let packs = [];
    if (source === "modrinth") {
        packs = await window.fetchModrinthPacks(currentModrinthQuery, 20, currentModrinthOffset);
    } else {
        packs = await window.fetchCurseForgePacks(currentModrinthQuery, 20, currentModrinthOffset);
    }

    if (loading) loading.style.display = "none";

    if (!packs || packs.length === 0) {
        if (!isLoadMore && grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 40px; font-weight: bold;">❌ ไม่พบข้อมูลที่ค้นหา!</div>`;
        window.isFetchingModrinth = false; 
        return;
    }

    packs.forEach(pack => {
        const card = document.createElement('div');
        card.className = 'modrinth-card';
        let dlCount = pack.downloads > 1000000 ? (pack.downloads / 1000000).toFixed(1) + 'M' : (pack.downloads > 1000 ? (pack.downloads / 1000).toFixed(1) + 'K' : pack.downloads);

        card.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center;">
                <img src="${pack.icon}" alt="icon" onerror="this.src='https://docs.modrinth.com/img/logo.svg'">
                <div style="flex: 1; overflow: hidden;">
                    <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pack.name}</h3>
                    <div style="font-size: 11px; color: ${source === 'curseforge' ? '#ea580c' : '#22c55e'}; font-weight: bold;">By ${pack.author}</div>
                </div>
            </div>
            <p style="margin: 0; font-size: 12px; color: #94a3b8; height: 50px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${pack.description}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div class="modrinth-badge">📥 ${dlCount}</div>
                <button class="btn-manage" style="margin: 0; background: ${source === 'curseforge' ? '#ea580c' : '#22c55e'}; color: white; padding: 8px 15px; border-radius: 6px; border: none; cursor: pointer;" 
                onclick="window.openModrinthDetails('${pack.id}', '${pack.name.replace(/'/g, "\\'")}', '${pack.icon}', '${pack.source}')">INSTALL</button>
            </div>
        `;
        grid.appendChild(card);
    });

    window.isFetchingModrinth = false; 
};

// 🟢 ป๊อปอัปแยกร่าง ดึงเวอร์ชันได้ทั้ง 2 ค่าย!
window.openModrinthDetails = async (projectId, packName, iconUrl, source = "modrinth") => {
    if (window.isInstalling) return alert("⏳ ใจเย็นวัยรุ่น! คอมกำลังปั่นมอดแพ็คอยู่!");
    const modal = document.getElementById('modrinth-modal');
    document.getElementById('mr-modal-title').innerText = packName;
    document.getElementById('mr-modal-icon').src = iconUrl || 'https://docs.modrinth.com/img/logo.svg';
    document.getElementById('mr-modal-desc').innerText = "⏳ กำลังสแกนหาเวอร์ชันทั้งหมด...";
    
    const select = document.getElementById('mr-modal-version');
    select.innerHTML = "<option>Loading...</option>";
    modal.style.display = "flex";

    try {
        if (source === "modrinth") {
            const verRes = await axios.get(`https://api.modrinth.com/v2/project/${projectId}/version`);
            select.innerHTML = "";
            verRes.data.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                option.innerText = `${v.name} (MC ${v.game_versions.join(', ')}) [${v.loaders.join(', ').toUpperCase()}]`;
                select.appendChild(option);
            });
        } else {
            // 🔥 ของ CurseForge
            // 👇 เปลี่ยนมาใช้ CF_CONFIG แทนให้หมด!
            const verRes = await axios.get(`https://api.curseforge.com/v1/mods/${projectId}/files`, CF_CONFIG);
            select.innerHTML = "";
            verRes.data.data.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                const mcVer = v.gameVersions.find(gv => gv.includes('.')) || "Unknown";
                option.innerText = `${v.displayName} (MC ${mcVer})`;
                select.appendChild(option);
            });
        }

        const btn = document.getElementById('mr-modal-install-btn');
        btn.style.background = source === 'curseforge' ? '#ea580c' : '#22c55e'; // เปลี่ยนสีปุ่มตามค่าย
        btn.onclick = () => {
            modal.style.display = "none";
            if (source === "modrinth") {
                window.installModrinthPack(projectId, packName, select.value, iconUrl);
            } else {
                window.installCurseForgePack(projectId, packName, select.value, iconUrl);
            }
        };
        document.getElementById('mr-modal-desc').innerText = `เลือกรุ่นที่ต้องการเล่นจาก ${source.toUpperCase()} แล้วกดติดตั้ง!`;
    } catch(e) {
        document.getElementById('mr-modal-desc').innerText = "❌ เกิดข้อผิดพลาดในการดึงข้อมูลเวอร์ชัน";
    }
};

// ==============================================================================
// 🟢 [NONG SUM PATCH] หุ่นยนต์ติดตั้ง Loader (รายงานผลเฉพาะหน้า Home)
// ==============================================================================
window.installLoaderSilently = async (installPath, loader, mcVersion, loaderVer) => {
    window.addLog(`⚙️ กำลังติดตั้งรันไทม์ Loader [${loader}]... (ขั้นตอนนี้ใช้เวลา 2-5 นาที)`, "info");
    const homeTxt = document.getElementById('home-dl-text');
    if (homeTxt) homeTxt.innerText = `⚙️ กำลังติดตั้ง ${loader.toUpperCase()}... (รอแป๊บนึง)`;

    try {
        const javaExe = await getJavaPath(mcVersion);

        if (loader === 'fabric' || loader === 'quilt') {
            const baseUrl = loader === 'fabric' ? `https://meta.fabricmc.net/v2/versions/loader` : `https://meta.quiltmc.org/v3/versions/loader`;
            const res = await axios.get(`${baseUrl}/${mcVersion}/${loaderVer}/profile/json`);
            const customName = res.data.id; 
            const dir = path.join(installPath, "versions", customName);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${customName}.json`), JSON.stringify(res.data));
            
        } else if (loader === 'forge' || loader === 'neoforge') {
            const isNeo = loader === 'neoforge';
            const installerPath = path.join(installPath, `${loader}-installer.jar`);
            
            const urls = isNeo ? [
                `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVer}/neoforge-${loaderVer}-installer.jar`,
                `https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/${loaderVer}/neoforge-${loaderVer}-installer.jar`
            ] : [
                `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${loaderVer}/forge-${mcVersion}-${loaderVer}-installer.jar`,
                `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${loaderVer}-${mcVersion}/forge-${mcVersion}-${loaderVer}-${mcVersion}-installer.jar`,
                `https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/${mcVersion}-${loaderVer}/forge-${mcVersion}-${loaderVer}-installer.jar`
            ];

            let downloaded = false;
            for (let u of urls) {
                try {
                    await downloadFileWithProgress(u, installerPath, 'update-mini-log', 'update-progress');
                    const buffer = fs.readFileSync(installerPath);
                    if (buffer.length > 50000 && buffer[0] === 0x50 && buffer[1] === 0x4B) { downloaded = true; break; }
                } catch(e) {}
            }
            if (!downloaded) throw new Error(`โหลด ${loader} ไม่สำเร็จ`);
            fs.writeFileSync(path.join(installPath, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));

            await new Promise((resolve, reject) => {
                let stderrLog = "";
                const child = spawn(javaExe, ['-jar', installerPath, '--installClient', installPath]);
                
                child.stdout.on('data', d => {
                    const msg = d.toString().trim();
                    if (msg && msg.includes("Downloading")) {
                        window.addLog(`📥 [${loader}]: ${msg}`);
                        if (homeTxt) homeTxt.innerText = `📥 โหลดไฟล์ระบบ: ${msg.substring(0, 30)}...`;
                    }
                });
                
                child.stderr.on('data', d => stderrLog += d.toString());
                child.on('error', (err) => reject(new Error("Java Error: " + err.message)));
                
                child.on('close', async (code) => {
                    if (code === 0) resolve();
                    else {
                        if (isNeo) return reject(new Error("NeoForge install failed"));
                        try {
                            const extractZip = require('extract-zip');
                            const tempDir = path.join(installPath, "temp_forge_installer");
                            await extractZip(installerPath, { dir: tempDir });
                            const profilePath = path.join(tempDir, "install_profile.json");
                            if (fs.existsSync(profilePath)) {
                                const versionInfo = JSON.parse(fs.readFileSync(profilePath)).versionInfo || JSON.parse(fs.readFileSync(profilePath)); 
                                const customName = versionInfo.id;
                                if (versionInfo.libraries) {
                                    versionInfo.libraries.forEach(lib => {
                                        if (lib.url) lib.url = lib.url.replace("http://", "https://").replace("files.minecraftforge.net/maven", "maven.minecraftforge.net");
                                        if (!lib.downloads) {
                                            const parts = lib.name.split(':');
                                            const jarPath = `${parts[0].replace(/\./g, '/')}/${parts[1]}/${parts[2]}/${parts[1]}-${parts[2]}.jar`;
                                            const baseUrl = lib.url || "https://libraries.minecraft.net/";
                                            lib.downloads = { artifact: { path: jarPath, url: baseUrl.endsWith('/') ? baseUrl + jarPath : baseUrl + '/' + jarPath } };
                                        }
                                    });
                                }
                                const targetVerDir = path.join(installPath, "versions", customName);
                                fs.mkdirSync(targetVerDir, { recursive: true });
                                fs.writeFileSync(path.join(targetVerDir, `${customName}.json`), JSON.stringify(versionInfo, null, 2));
                                const forgeJar = fs.readdirSync(tempDir).find(f => f.endsWith('-universal.jar') || (f.startsWith('forge-') && f.endsWith('.jar')));
                                if (forgeJar) {
                                    const forgeLib = versionInfo.libraries.find(l => l.name && l.name.startsWith("net.minecraftforge:forge"));
                                    if (forgeLib) {
                                        const parts = forgeLib.name.split(':'); 
                                        const libDest = path.join(installPath, "libraries", parts[0].replace(/\./g, '/'), parts[1], parts[2], `${parts[1]}-${parts[2]}.jar`);
                                        fs.mkdirSync(path.dirname(libDest), { recursive: true });
                                        fs.copyFileSync(path.join(tempDir, forgeJar), libDest);
                                    }
                                }
                                fs.rmSync(tempDir, { recursive: true, force: true });
                                resolve();
                            } else reject(new Error("Forge Fail"));
                        } catch(e) { reject(e); }
                    }
                });
            });
        }
        window.addLog(`✅ ติดตั้ง Loader (${loader}) สมบูรณ์!`, "success");
    } catch(e) {
        window.addLog(`❌ ติดตั้ง Loader พลาด: ${e.message}`, "error");
        throw e;
    }
};

// ==============================================================================
// 🟢 [NONG SUM PATCH] ระบบสร้างการ์ดเปอร์เซ็นต์หน้า Home + ติดตั้ง Modrinth
// ==============================================================================

// ฟังก์ชันเสกการ์ดโหลดหน้าโฮม
window.showDownloadingCard = (packName, iconUrl) => {
    const grid = document.getElementById('welcome-pack-grid');
    if (!grid || document.getElementById('downloading-card')) return;

    const card = document.createElement('div');
    card.id = 'downloading-card';
    card.style.background = 'rgba(26,26,26,0.8)';
    card.style.borderRadius = '16px';
    card.style.padding = '20px';
    card.style.border = '2px dashed #eab308'; // กรอบเส้นประสีเหลือง
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.boxShadow = '0 0 20px rgba(234, 179, 8, 0.2)';

    let iconHtml = iconUrl ? `<img src="${iconUrl}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 16px; margin-bottom: 15px; filter: grayscale(30%); opacity: 0.8;">` : `<div style="font-size: 60px; margin-bottom: 15px;">⏳</div>`;

    card.innerHTML = `
        ${iconHtml}
        <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #fff; text-align: center;">${packName}</h3>
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #eab308;">⏳ กำลังติดตั้ง...</p>
        <div style="width: 100%; background: #333; border-radius: 10px; overflow: hidden; height: 10px; margin-top: 10px; border: 1px solid #444;">
            <div id="home-dl-progress" style="width: 0%; height: 100%; background: #eab308; transition: 0.3s;"></div>
        </div>
        <p id="home-dl-text" style="margin: 8px 0 0 0; font-size: 11px; color: #ccc; text-align: center;">กำลังเตรียมไฟล์...</p>
    `;
    grid.insertBefore(card, grid.firstChild); // แทรกลงไปใบแรกสุดของหน้าโฮม
};

// ฟังก์ชันติดตั้งมอดแพ็คจาก Modrinth (ดึงข้อมูลเวอร์ชัน, โหลดไฟล์, อัปเดตสถานะไปหน้า Home)
// ==============================================================================
// 🟢 [NONG SUM PATCH] ระบบดาวน์โหลด Modrinth + อัปเดตความจำ + ระบบปลดล็อคเกม
// ==============================================================================
window.installModrinthPack = async (projectId, packName, versionId, iconUrl) => {
    if (window.isInstalling) return alert("กำลังติดตั้งมอดแพ็คอื่นอยู่ รอแป๊บนึง!");
    window.isInstalling = true; 

    // 🧠 บันทึกความจำลงสมองระบบ!
    window.activeDownloadInfo = { name: packName, icon: iconUrl, percent: 0, text: "กำลังเตรียมไฟล์..." };

    document.getElementById('modrinth-modal').style.display = "none";
    window.goPage('page-welcome'); 
    window.showDownloadingCard(packName, iconUrl);

    const logPanel = document.getElementById('log-panel');
    if (logPanel && !logPanel.classList.contains('open')) window.toggleLog();

    const updateStatus = (percent, text) => {
        // อัปเดตความจำตลอดเวลา
        if (window.activeDownloadInfo) {
            window.activeDownloadInfo.percent = percent;
            window.activeDownloadInfo.text = text;
        }
        
        setMiniLog('update-mini-log', text, 'update-progress', percent);
        const homeBar = document.getElementById('home-dl-progress');
        const homeTxt = document.getElementById('home-dl-text');
        if (homeBar) homeBar.style.width = `${percent}%`;
        if (homeTxt) homeTxt.innerText = text;
    };

    window.addLog(`⚙️ เริ่มกระบวนการติดตั้งมอดแพ็คระดับพระกาฬ: ${packName}`, "info");
    const safeName = packName.replace(/[^a-zA-Z0-9]/g, '_');
    const tempPackPath = path.join(baseDir, `${safeName}.mrpack`);
    const extractPath = path.join(baseDir, `temp_mrpack_${safeName}`);

    try {
        updateStatus(5, "กำลังดึงข้อมูลไฟล์...");
        const verRes = await axios.get(`https://api.modrinth.com/v2/version/${versionId}`);
        const selectedVer = verRes.data;
        const downloadUrl = selectedVer.files.find(f => f.filename.endsWith('.mrpack'))?.url || selectedVer.files[0].url;
        
        updateStatus(10, "กำลังโหลดใบสั่งของ...");
        await downloadFileWithProgress(downloadUrl, tempPackPath, 'update-mini-log', 'update-progress');

        updateStatus(15, "กำลังแกะกล่องไฟล์...");
        const extractZip = require('extract-zip');
        await extractZip(tempPackPath, { dir: extractPath });

        const indexPath = path.join(extractPath, "modrinth.index.json");
        if (!fs.existsSync(indexPath)) throw new Error("ไฟล์เสีย! ไม่พบใบสั่งของ");
        const indexData = JSON.parse(fs.readFileSync(indexPath));

        const mcVer = indexData.dependencies.minecraft;
        let loader = "vanilla", loaderVer = "latest";
        if (indexData.dependencies['fabric-loader']) { loader = "fabric"; loaderVer = indexData.dependencies['fabric-loader']; }
        else if (indexData.dependencies.forge) { loader = "forge"; loaderVer = indexData.dependencies.forge; }
        else if (indexData.dependencies.neoforge) { loader = "neoforge"; loaderVer = indexData.dependencies.neoforge; }
        else if (indexData.dependencies['quilt-loader']) { loader = "quilt"; loaderVer = indexData.dependencies['quilt-loader']; } // 👈 [NONG SUM PATCH] เติมคำว่า -loader ตรงนี้ให้ตรงกับ Modrinth!

        const installPath = path.join(baseDir, `custom-${mcVer}-${loader}-${safeName}`);
        if (!fs.existsSync(installPath)) fs.mkdirSync(installPath, { recursive: true });

        if (iconUrl) {
            try {
                const iconRes = await axios({ method: 'GET', url: iconUrl, responseType: 'arraybuffer' });
                fs.writeFileSync(path.join(installPath, 'icon.png'), Buffer.from(iconRes.data));
            } catch(e) {}
        }

        const filesToDownload = indexData.files || [];
        
        let successCount = 0;
        for (let i = 0; i < filesToDownload.length; i++) {
            const fileInfo = filesToDownload[i];
            if (fileInfo.env && fileInfo.env.client === "unsupported") continue;

            const targetFilePath = path.join(installPath, fileInfo.path);
            fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
            
            const percent = 15 + Math.round(((i + 1) / filesToDownload.length) * 80); 
            const statusText = `โหลดมอด: ${i + 1}/${filesToDownload.length} (${percent}%)`;
            updateStatus(percent, statusText);
            
            try {
                const res = await axios({ method: 'GET', url: fileInfo.downloads[0], responseType: 'arraybuffer' });
                fs.writeFileSync(targetFilePath, Buffer.from(res.data));
                successCount++;
            } catch (err) {
                window.addLog(`⚠️ โหลดพลาด: ${path.basename(fileInfo.path)}`, "error");
            }
        }

        updateStatus(95, "กำลังตั้งค่าโฟลเดอร์...");
        const overridesPath = path.join(extractPath, "overrides");
        if (fs.existsSync(overridesPath)) fs.cpSync(overridesPath, installPath, { recursive: true });

        fs.rmSync(extractPath, { recursive: true, force: true });
        fs.unlinkSync(tempPackPath);

        if (loader !== "vanilla") {
            updateStatus(99, `ติดตั้ง ${loader.toUpperCase()}... (รอสักครู่)`);
            await window.installLoaderSilently(installPath, loader, mcVer, loaderVer);
        }

        window.addLog(`🎉 ติดตั้งสำเร็จพร้อมเล่น!`, "success");
        updateStatus(100, "ติดตั้งสำเร็จ!");

        window.isInstalling = false; 
        window.activeDownloadInfo = null; // ล้างความจำเมื่อโหลดเสร็จ

        window.showWelcomePage(localStorage.getItem('user') || "Player");
        setTimeout(() => alert(`✨ ติดตั้งมอดแพ็ค [${safeName}] เสร็จสิ้น 100%!\n\nกดเข้าเล่นได้เลยวัยรุ่น! 🚀`), 500);

    } catch (e) {
        window.addLog(`❌ เกิดข้อผิดพลาด: ${e.message}`, "error");
        updateStatus(0, "เกิดข้อผิดพลาด!");
        const homeBar = document.getElementById('home-dl-progress');
        if (homeBar) homeBar.style.background = "#ef4444"; 
        window.isInstalling = false; 
        window.activeDownloadInfo = null; // ล้างความจำถ้าพัง
    }
};

// ==============================================================================
// 🟢 [NONG SUM PATCH] เซ็นเซอร์ตรวจจับการเลื่อนจอ (Infinite Scroll)
// ==============================================================================
const mainContentScroll = document.querySelector('.main-content');
if (mainContentScroll) {
    mainContentScroll.addEventListener('scroll', function() {
        // ทำงานเฉพาะตอนอยู่หน้า Modrinth Browser เท่านั้น
        const modrinthPage = document.getElementById('page-modrinth');
        if (!modrinthPage || !modrinthPage.classList.contains('active')) return;
        
        // ถ้าเลื่อนลงมาจนห่างจากขอบล่างไม่เกิน 150px
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 150) {
            // ถ้าระบบไม่ได้โหลดอะไรค้างอยู่ สั่งดึงข้อมูลหน้าถัดไปเลย!
            if (!window.isFetchingModrinth) {
                window.searchModrinth(null, true);
            }
        }
    });
}

// ==============================================================================
// 🟢 [NONG SUM PATCH] ระบบดาวน์โหลด SHADER + ไถหน้าจอโหลดเพิ่มเติม (Infinite Scroll)
// ==============================================================================
window.isFetchingShader = false; 
window.currentShaderOffset = 0;
window.currentShaderMcVer = "1.21.1";

window.openShaderBrowser = async () => {
    if (!selectedPack) return alert("กรุณาเลือกมอดแพ็คก่อนนะครับวัยรุ่น!");
    
    // 🔍 หาเวอร์ชันเกม
    let mcVer = "1.21.1";
    if (modpacks[selectedPack]) {
        mcVer = modpacks[selectedPack].version;
    } else if (selectedPack.startsWith('custom-')) {
        mcVer = selectedPack.split('-')[1];
    }
    
    window.currentShaderMcVer = mcVer;
    window.currentShaderOffset = 0; // เริ่มนับ 1 ใหม่

    const modal = document.getElementById('shader-browser-modal');
    const grid = document.getElementById('shader-grid');
    const info = document.getElementById('shader-ver-info');
    
    modal.style.display = "flex";
    grid.innerHTML = "";
    info.innerText = `แสดงรายการ Shader ที่รองรับเวอร์ชัน Minecraft ${mcVer} 💎`;

    // สั่งโหลดข้อมูลชุดแรก
    await window.loadMoreShaders(true);
};

// 🟢 ฟังก์ชันโหลด Shader (เรียกใช้ซ้ำเวลาเลื่อนจอ)
window.loadMoreShaders = async (isFirstLoad = false) => {
    if (window.isFetchingShader) return;
    window.isFetchingShader = true;

    const grid = document.getElementById('shader-grid');
    const loading = document.getElementById('shader-loading');
    const mcVer = window.currentShaderMcVer;

    if (!isFirstLoad) {
        window.currentShaderOffset += 20; // บวกไปอีก 20 รายการ
    }
    loading.style.display = "block";

    try {
        const facets = encodeURIComponent(JSON.stringify([["project_type:shader"], [`versions:${mcVer}`]]));
        const url = `https://api.modrinth.com/v2/search?facets=${facets}&limit=20&offset=${window.currentShaderOffset}&index=downloads`;
        
        const response = await axios.get(url);
        const shaders = response.data.hits;

        loading.style.display = "none";

        if (!shaders || shaders.length === 0) {
            if (isFirstLoad) {
                grid.innerHTML = `<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: #ff4444;">ไม่พบ Shader ที่รองรับเวอร์ชันนี้ครับวัยรุ่น!</p>`;
            } else {
                window.addLog("โหลด Shader มาหมดคลังแล้ว!", "success");
            }
            window.isFetchingShader = false;
            return;
        }

        shaders.forEach(item => {
            const card = document.createElement('div');
            card.className = 'modrinth-card';
            card.style.background = 'rgba(30,30,30,0.6)';
            
            card.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: center;">
                    <img src="${item.icon_url || 'https://docs.modrinth.com/img/logo.svg'}" style="width: 50px; height: 50px; border-radius: 8px;">
                    <div style="overflow: hidden;">
                        <h4 style="margin: 0; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</h4>
                        <div style="font-size: 10px; color: #22c55e;">โดย ${item.author}</div>
                    </div>
                </div>
                <p style="font-size: 11px; color: #aaa; height: 40px; overflow: hidden; margin: 10px 0;">${item.description}</p>
                <button class="btn-primary" style="padding: 8px; font-size: 12px;" onclick="window.installShader('${item.project_id}', '${item.title.replace(/'/g, "\\'")}', '${mcVer}')">📥 ติดตั้ง SHADER</button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        loading.style.display = "none";
        if (isFirstLoad) grid.innerHTML = `<p style="color: red;">พังครับวัยรุ่น: ${e.message}</p>`;
    }

    window.isFetchingShader = false;
};

// 🟢 เซ็นเซอร์จับการเลื่อนจอ (ดักใน #shader-grid)
const shaderGridScroll = document.getElementById('shader-grid');
if (shaderGridScroll) {
    shaderGridScroll.addEventListener('scroll', function() {
        // ถ้าเลื่อนลงมาใกล้สุดขอบล่าง (เผื่อไว้ 100px)
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
            if (!window.isFetchingShader) {
                window.loadMoreShaders(false); // สั่งดึงหน้าต่อไป!
            }
        }
    });
}

// 🟢 ฟังก์ชันดาวน์โหลดและติดตั้ง
window.installShader = async (projectId, title, mcVer) => {
    try {
        window.addLog(`🔍 กำลังหาเวอร์ชันที่เหมาะสมสำหรับ ${title}...`);
        
        const verRes = await axios.get(`https://api.modrinth.com/v2/project/${projectId}/version?game_versions=["${mcVer}"]`);
        if (verRes.data.length === 0) throw new Error("ไม่พบไฟล์ Shader ที่รองรับเวอร์ชันนี้บน Modrinth");

        const targetVer = verRes.data[0]; 
        const file = targetVer.files.find(f => f.primary) || targetVer.files[0];
        
        const shaderDir = path.join(baseDir, selectedPack, 'shaderpacks');
        if (!fs.existsSync(shaderDir)) fs.mkdirSync(shaderDir, { recursive: true });

        const destPath = path.join(shaderDir, file.filename);

        window.addLog(`📥 กำลังดาวน์โหลด Shader: ${file.filename}...`);
        await downloadFileWithProgress(file.url, destPath, 'update-mini-log', 'update-progress');

        window.addLog(`✅ ติดตั้ง ${title} เรียบร้อย!`, "success");
        alert(`✨ ติดตั้ง ${title} สำเร็จ!\\n\\nวัยรุ่นอย่าลืมลงมอด IRIS หรือ OPTIFINE ในมอดแพ็คด้วยนะ ไม่งั้นเลือกใช้ไม่ได้นะครับ! 🚀`);
    } catch (e) {
        window.addLog(`❌ ลง Shader ไม่สำเร็จ: ${e.message}`, "error");
        alert(`ติดตั้งล้มเหลว: ${e.message}`);
    }
};

// ==============================================================================
// 🔥 [NONG SUM PATCH] ระบบอ่านใบสั่งของ CurseForge (หลบ Windows ล็อคไฟล์ 1000%)
// ==============================================================================
window.installCurseForgePack = async (projectId, packName, fileId, iconUrl) => {
    if (window.isInstalling) return alert("กำลังติดตั้งมอดแพ็คอื่นอยู่ รอแป๊บนึง!");
    window.isInstalling = true; 
    window.activeDownloadInfo = { name: packName, icon: iconUrl, percent: 0, text: "กำลังเตรียมไฟล์..." };

    window.goPage('page-welcome'); 
    window.showDownloadingCard(packName, iconUrl);

    const updateStatus = (percent, text) => {
        if (window.activeDownloadInfo) { window.activeDownloadInfo.percent = percent; window.activeDownloadInfo.text = text; }
        setMiniLog('update-mini-log', text, 'update-progress', percent);
        const homeBar = document.getElementById('home-dl-progress');
        const homeTxt = document.getElementById('home-dl-text');
        if (homeBar) homeBar.style.width = `${percent}%`;
        if (homeTxt) homeTxt.innerText = text;
    };

    window.addLog(`🔥 เริ่มดึงมอดแพ็คระดับพระกาฬจาก CurseForge: ${packName}`, "info");
    const safeName = packName.replace(/[^a-zA-Z0-9]/g, '_');
    
    // 🚀 [NONG SUM ไอเทมลับ] เติมรหัสสุ่ม (Timestamp) ต่อท้ายชื่อไฟล์ชั่วคราว!
    // ต่อให้ Windows หรือ Antivirus ล็อคไฟล์เก่าไว้ เราก็รอดเพราะสร้างชื่อใหม่เสมอ!
    const uniqueId = Date.now();
    const tempPackPath = path.join(baseDir, `temp_${safeName}_${uniqueId}.zip`);
    const extractPath = path.join(baseDir, `temp_cfpack_${safeName}_${uniqueId}`);

    try {
        updateStatus(5, "กำลังขอลิงก์ดาวน์โหลดหลัก...");
        
        const fileRes = await axios.get(`https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`, CF_CONFIG);
        let downloadUrl = fileRes.data.data.downloadUrl;
        
        if (!downloadUrl) {
            const fIdStr = String(fileId);
            downloadUrl = `https://edge.forgecdn.net/files/${fIdStr.slice(0, 4)}/${fIdStr.slice(4)}/${fileRes.data.data.fileName}`;
        }

        updateStatus(10, "กำลังโหลดตัวแพ็ค...");
        await downloadFileWithProgress(downloadUrl, tempPackPath, 'update-mini-log', 'update-progress');

        updateStatus(15, "กำลังแกะกล่องไฟล์ ZIP...");
        const extractZip = require('extract-zip');
        await extractZip(tempPackPath, { dir: extractPath });

        const manifestPath = path.join(extractPath, "manifest.json");
        if (!fs.existsSync(manifestPath)) throw new Error("ไฟล์เสีย! ไม่พบใบสั่งของ manifest.json");
        const manifest = JSON.parse(fs.readFileSync(manifestPath));

        const mcVer = manifest.minecraft.version;
        let loader = "vanilla", loaderVer = "latest";
        
        if (manifest.minecraft.modLoaders && manifest.minecraft.modLoaders.length > 0) {
            const primaryLoader = manifest.minecraft.modLoaders.find(l => l.primary) || manifest.minecraft.modLoaders[0];
            const lId = primaryLoader.id; 
            if (lId.startsWith("forge")) { loader = "forge"; loaderVer = lId.split('-')[1]; }
            else if (lId.startsWith("neoforge")) { loader = "neoforge"; loaderVer = lId.split('-')[1]; }
            else if (lId.startsWith("fabric")) { loader = "fabric"; loaderVer = lId.split('-')[1]; }
            else if (lId.startsWith("quilt")) { loader = "quilt"; loaderVer = lId.split('-')[1]; }
        }

        const installPath = path.join(baseDir, `custom-${mcVer}-${loader}-${safeName}`);
        
        // 🚨 ล้างบางโฟลเดอร์เกมเก่า (ถ้ามี) แบบดุดัน
        if (fs.existsSync(installPath)) {
            try { fs.rmSync(installPath, { recursive: true, force: true }); } 
            catch(e) { window.addLog(`⚠️ คำเตือน: ทับของเก่าไม่ได้ทั้งหมด`, "error"); }
        }
        fs.mkdirSync(installPath, { recursive: true });

        if (iconUrl) {
            try {
                const iconRes = await axios({ method: 'GET', url: iconUrl, responseType: 'arraybuffer' });
                fs.writeFileSync(path.join(installPath, 'icon.png'), Buffer.from(iconRes.data));
            } catch(e) {}
        }

        const filesToDownload = manifest.files || [];
        
        for (let i = 0; i < filesToDownload.length; i++) {
            const fileInfo = filesToDownload[i];
            const modsDir = path.join(installPath, "mods");
            if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
            
            const percent = 15 + Math.round(((i + 1) / filesToDownload.length) * 80); 
            updateStatus(percent, `โหลดมอด: ${i + 1}/${filesToDownload.length} (${percent}%)`);
            
            try {
                const modRes = await axios.get(`https://api.curseforge.com/v1/mods/${fileInfo.projectID}/files/${fileInfo.fileID}`, CF_CONFIG);
                const modData = modRes.data.data;
                
                let modDlUrl = modData.downloadUrl;
                if (!modDlUrl) { 
                    const fIdStr = String(fileInfo.fileID);
                    modDlUrl = `https://edge.forgecdn.net/files/${fIdStr.slice(0, 4)}/${fIdStr.slice(4)}/${modData.fileName}`;
                }
                
                const targetFilePath = path.join(modsDir, modData.fileName);
                const res = await axios({ method: 'GET', url: modDlUrl, responseType: 'arraybuffer' });
                fs.writeFileSync(targetFilePath, Buffer.from(res.data));
            } catch (err) {
                window.addLog(`⚠️ โหลดมอดพลาด (ID: ${fileInfo.projectID}): ${err.message}`, "error");
            }
        }

        updateStatus(95, "กำลังตั้งค่าโฟลเดอร์ (Overrides)...");
        const overridesDirName = manifest.overrides || "overrides";
        const overridesPath = path.join(extractPath, overridesDirName);
        if (fs.existsSync(overridesPath)) fs.cpSync(overridesPath, installPath, { recursive: true });

        // 🧹 พยายามล้างซากไฟล์ชั่วคราว (ถ้าติดล็อคก็ปล่อยผ่าน ไม่ Error!)
        try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch(e){}
        try { fs.unlinkSync(tempPackPath); } catch(e){}

        if (loader !== "vanilla") {
            updateStatus(99, `ติดตั้ง ${loader.toUpperCase()}... (รอสักครู่)`);
            await window.installLoaderSilently(installPath, loader, mcVer, loaderVer);
        }

        window.addLog(`🎉 ติดตั้งสำเร็จพร้อมเล่น!`, "success");
        updateStatus(100, "ติดตั้งสำเร็จ!");
        window.isInstalling = false; 
        window.activeDownloadInfo = null; 

        window.showWelcomePage(localStorage.getItem('user') || "Player");
        setTimeout(() => alert(`✨ ติดตั้งมอดแพ็ค [${safeName}] จาก CurseForge เสร็จสิ้น 100%!\\n\\nกดเข้าเล่นได้เลยวัยรุ่น! 🚀`), 500);

    } catch (e) {
        window.addLog(`❌ เกิดข้อผิดพลาด (CurseForge): ${e.message}`, "error");
        updateStatus(0, "เกิดข้อผิดพลาด!");
        const homeBar = document.getElementById('home-dl-progress');
        if (homeBar) homeBar.style.background = "#ef4444"; 
        window.isInstalling = false; 
        window.activeDownloadInfo = null; 
        
        // พยายามล้างขยะถ้าพังกลางทาง
        try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch(err){}
        try { fs.unlinkSync(tempPackPath); } catch(err){}
    }
};