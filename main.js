const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require("electron-updater");
const path = require('path');
const msmc = require('msmc'); // 👈 เรียกใช้งานตัวล็อคอินที่หลังบ้าน

// 🟢 ระบบแจ้งเตือนหลังบ้าน (ดูผ่าน Console)
autoUpdater.on('update-available', () => {
    console.log('✨ เจอเวอร์ชันใหม่แล้ว! กำลังโหลด...');
});

autoUpdater.on('update-downloaded', () => {
    console.log('✅ โหลดอัปเดตเสร็จแล้ว! เตรียมติดตั้งตอนปิดโปรแกรม');
    // หรือถ้าอยากให้มันบังคับรีสตาร์ทแอปแล้วอัปเดตทันที ให้เอาเครื่องหมาย // ข้างหน้าบรรทัดล่างออก:
    // autoUpdater.quitAndInstall();
});

function createWindow () {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });
  win.loadFile('index.html');
}

// 🟢 เมื่อโปรแกรมพร้อม ให้เปิดหน้าต่าง และเช็คอัปเดตทันที!
app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});

// 🎯 สร้างช่องทางพิเศษให้หน้าเว็บส่งคำสั่งมาขอล็อคอิน
ipcMain.handle('ms-login', async (event) => {
    try {
        const authManager = new msmc.Auth("select_account");
        
        // สั่งเปิดหน้าต่าง Popup เล็กๆ สำหรับล็อคอิน (แบบปลอดภัย จอไม่ขาว)
        const xboxManager = await authManager.launch("electron");
        const token = await xboxManager.getMinecraft();
        
        // ส่งตั๋วกลับไปให้หน้า Launcher
        return token.mclc(); 
    } catch (error) {
        console.log("Login Error:", error);
        return null; // ถ้าล็อคอินไม่ผ่าน หรือกดกากบาทปิดไปก่อน
    }
});