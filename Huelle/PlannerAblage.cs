/* Planner-Ablage – Hülle für den Drop-Punkt (ing Burghausen GmbH)
 *
 * Ein kleiner runder Punkt auf dem Bildschirm. Datei darauf ziehen → daneben öffnet sich das
 * Formular "Aufgabe in Planner" (Web-Seite in WebView2), das die Datei ins Jahres-Team hochlädt
 * und die Planner-Aufgabe anlegt. Der Punkt ist verschiebbar (ziehen), skalierbar (Mausrad),
 * kann im Vordergrund gehalten werden (Rechtsklick) und merkt sich alles in
 * %APPDATA%\PlannerAblage\settings.json.
 *
 * Wird beim ersten Start lokal mit dem in Windows enthaltenen C#-Compiler übersetzt (Start.cmd).
 * Sprachstand C# 5 (csc 4.8 aus .NET Framework) – keine neueren Sprachfeatures verwenden.
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PlannerAblage
{
    /* ---------- Einstieg ---------- */

    static class App
    {
        public const string Version = "0.3";
        public const string InstallCommand = "irm https://raw.githubusercontent.com/ingmoedl/planner-ablage/main/install.ps1 | iex";
        public const string DefaultPageUrl = "https://ingmoedl.github.io/planner-ablage/index.html";
        public static readonly string DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PlannerAblage");
        public static readonly string LocalDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PlannerAblage");
        public static Settings Cfg;

        [STAThread]
        static void Main(string[] args)
        {
            bool created;
            using (var mutex = new Mutex(true, "Local\\PlannerAblage_Punkt", out created))
            {
                if (!created) return; // läuft schon
                Dpi.Enable();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try { Directory.CreateDirectory(DataDir); Directory.CreateDirectory(LocalDir); } catch (Exception) { }
                bool firstRun = !File.Exists(Path.Combine(DataDir, "settings.json"));
                Cfg = Settings.Load();
                if (firstRun && !Autostart.IsEnabled()) Autostart.Set(true); // ab dem ersten Start mit Windows starten
                Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e)
                {
                    MessageBox.Show("Unerwarteter Fehler:\n\n" + e.Exception.Message, "Planner-Ablage", MessageBoxButtons.OK, MessageBoxIcon.Error);
                };
                // Entwicklung/Test: PlannerAblage.exe <Datei> [<Datei> ...] öffnet das Formular sofort mit diesen Dateien
                var testFiles = new List<string>();
                foreach (var a in args) if (File.Exists(a)) testFiles.Add(a);
                Application.Run(new DropForm(testFiles));
                GC.KeepAlive(mutex);
            }
        }

        public static void Log(string text)
        {
            try
            {
                File.AppendAllText(Path.Combine(LocalDir, "log.txt"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + text + Environment.NewLine);
            }
            catch (Exception) { }
        }
    }

    /* ---------- Einstellungen ---------- */

    public class Settings
    {
        public int X = int.MinValue;
        public int Y = int.MinValue;
        public int Size = 96;
        public bool TopMost = true;
        public double Opacity = 0.92;
        public string PageUrl = App.DefaultPageUrl;   // https-Adresse oder lokaler Pfad zu index.html (Entwicklung)
        public int FormWidth = 440;
        public int FormHeight = 780;

        static string PathFile { get { return Path.Combine(App.DataDir, "settings.json"); } }

        public static Settings Load()
        {
            try
            {
                if (File.Exists(PathFile))
                {
                    var s = new JavaScriptSerializer().Deserialize<Settings>(File.ReadAllText(PathFile, Encoding.UTF8));
                    if (s != null)
                    {
                        if (string.IsNullOrEmpty(s.PageUrl)) s.PageUrl = App.DefaultPageUrl;
                        if (s.Opacity < 0.3 || s.Opacity > 1) s.Opacity = 0.92;
                        return s;
                    }
                }
            }
            catch (Exception e) { App.Log("Einstellungen lesen: " + e.Message); }
            return new Settings();
        }

        public void Save()
        {
            try { File.WriteAllText(PathFile, new JavaScriptSerializer().Serialize(this), Encoding.UTF8); }
            catch (Exception e) { App.Log("Einstellungen speichern: " + e.Message); }
        }
    }

    /* ---------- Der Punkt ---------- */

    class DropForm : Form
    {
        static readonly Color Accent = Color.FromArgb(0x18, 0x5c, 0x37);
        static readonly Color AccentHov = Color.FromArgb(0x1f, 0x74, 0x46);
        static readonly Color AccentDrop = Color.FromArgb(0x2e, 0x9e, 0x5e);

        bool hover, dragOver, moving, moved;
        Point moveStart, moveOrigin;
        ContextMenuStrip menu;
        ToolStripMenuItem miTop, miAutostart;
        ToolTip tip;
        readonly List<string> initialFiles;

        public DropForm(List<string> initialFiles)
        {
            this.initialFiles = initialFiles ?? new List<string>();
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Text = "Planner-Ablage";
            TopMost = App.Cfg.TopMost;
            AllowDrop = true;
            DoubleBuffered = true;
            BackColor = Color.White;
            Opacity = App.Cfg.Opacity;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
            int s = Clamp(App.Cfg.Size, 56, 400);
            ClientSize = new Size(s, s);
            PlaceOnScreen();
            BuildMenu();
            tip = new ToolTip();
            tip.SetToolTip(this, "Datei hierher ziehen → Aufgabe in Planner\nDoppelklick: Formular ohne Datei\nMausrad: Größe · Rechtsklick: Optionen");
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            // Rahmenlose Formulare bekommen beim Erzeugen des Fensters manchmal eine andere Größe → hier erzwingen
            int s = Clamp(App.Cfg.Size, 56, 400);
            if (ClientSize.Width != s || ClientSize.Height != s) ClientSize = new Size(s, s);
            if (initialFiles.Count > 0)
            {
                string dir = Path.Combine(App.LocalDir, "drop", Guid.NewGuid().ToString("N"));
                var data = new DataObject(DataFormats.FileDrop, initialFiles.ToArray());
                try { OpenTask(Dropped.Extract(data, dir), dir); }
                catch (Exception ex) { App.Log("Testdateien: " + ex.Message); }
            }
        }

        /* Position aus den Einstellungen, aber nur wenn sie noch auf einem Bildschirm liegt. */
        void PlaceOnScreen()
        {
            var wanted = new Rectangle(App.Cfg.X, App.Cfg.Y, Width, Height);
            bool visible = false;
            if (App.Cfg.X != int.MinValue)
            {
                foreach (var sc in Screen.AllScreens)
                {
                    var r = sc.WorkingArea; r.Inflate(-Width / 2, -Height / 2);
                    if (r.Contains(wanted.Location) || sc.WorkingArea.IntersectsWith(wanted) && sc.WorkingArea.Contains(new Point(wanted.X + Width / 2, wanted.Y + Height / 2))) { visible = true; break; }
                }
            }
            if (visible) Location = wanted.Location;
            else
            {
                var wa = Screen.PrimaryScreen.WorkingArea;
                Location = new Point(wa.Right - Width - 40, wa.Bottom - Height - 60);
                SavePosition();
            }
        }

        void BuildMenu()
        {
            menu = new ContextMenuStrip();
            miTop = new ToolStripMenuItem("Im Vordergrund halten");
            miTop.CheckOnClick = true; miTop.Checked = TopMost;
            miTop.CheckedChanged += delegate { TopMost = miTop.Checked; App.Cfg.TopMost = TopMost; App.Cfg.Save(); };
            menu.Items.Add(miTop);

            var miOpen = new ToolStripMenuItem("Formular öffnen (ohne Datei)");
            miOpen.Click += delegate { OpenTask(new List<DroppedFile>()); };
            menu.Items.Add(miOpen);

            var miSize = new ToolStripMenuItem("Größe");
            foreach (var kv in new[] { new KeyValuePair<string, int>("Klein", 64), new KeyValuePair<string, int>("Mittel", 96), new KeyValuePair<string, int>("Groß", 140), new KeyValuePair<string, int>("Sehr groß", 200) })
            {
                var item = new ToolStripMenuItem(kv.Key); int sz = kv.Value;
                item.Click += delegate { SetPointSize(sz); };
                miSize.DropDownItems.Add(item);
            }
            menu.Items.Add(miSize);

            var miOpacity = new ToolStripMenuItem("Deckkraft");
            foreach (var kv in new[] { new KeyValuePair<string, double>("100 %", 1.0), new KeyValuePair<string, double>("90 %", 0.92), new KeyValuePair<string, double>("70 %", 0.7), new KeyValuePair<string, double>("50 %", 0.5) })
            {
                var item = new ToolStripMenuItem(kv.Key); double op = kv.Value;
                item.Click += delegate { Opacity = op; App.Cfg.Opacity = op; App.Cfg.Save(); };
                miOpacity.DropDownItems.Add(item);
            }
            menu.Items.Add(miOpacity);

            menu.Items.Add(new ToolStripSeparator());
            miAutostart = new ToolStripMenuItem("Mit Windows starten");
            miAutostart.CheckOnClick = true; miAutostart.Checked = Autostart.IsEnabled();
            miAutostart.CheckedChanged += delegate { Autostart.Set(miAutostart.Checked); miAutostart.Checked = Autostart.IsEnabled(); };
            menu.Items.Add(miAutostart);

            var miUpdate = new ToolStripMenuItem("Aktualisieren (neueste Version holen)");
            miUpdate.Click += delegate
            {
                try
                {
                    Process.Start(new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -Command \"" + App.InstallCommand + "\"") { UseShellExecute = true });
                }
                catch (Exception ex) { MessageBox.Show("Aktualisierung konnte nicht gestartet werden:\n" + ex.Message, "Planner-Ablage"); }
            };
            menu.Items.Add(miUpdate);

            var miLog = new ToolStripMenuItem("Protokoll-Ordner öffnen");
            miLog.Click += delegate { try { Process.Start("explorer.exe", App.LocalDir); } catch (Exception) { } };
            menu.Items.Add(miLog);

            var miAbout = new ToolStripMenuItem("Planner-Ablage v" + App.Version);
            miAbout.Enabled = false;
            menu.Items.Add(miAbout);

            menu.Items.Add(new ToolStripSeparator());
            var miExit = new ToolStripMenuItem("Beenden");
            miExit.Click += delegate { Close(); };
            menu.Items.Add(miExit);
            ContextMenuStrip = menu;
        }

        /* --- Form + Zeichnen --- */

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            using (var gp = new GraphicsPath())
            {
                gp.AddEllipse(0, 0, ClientSize.Width, ClientSize.Height);
                Region = new Region(gp);
            }
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(BackColor);
            int Width = ClientSize.Width, Height = ClientSize.Height;
            var rect = new Rectangle(1, 1, Width - 3, Height - 3);
            Color fill = dragOver ? AccentDrop : (hover ? AccentHov : Accent);
            using (var br = new LinearGradientBrush(rect, ControlPaint.Light(fill, 0.15f), fill, 60f)) g.FillEllipse(br, rect);
            using (var pen = new Pen(Color.FromArgb(dragOver ? 255 : 120, Color.White), dragOver ? Math.Max(3f, Width / 24f) : Math.Max(1.5f, Width / 48f)))
                g.DrawEllipse(pen, rect);

            // Pfeil nach unten in eine Ablage-Schale
            float w = Width, h = Height;
            float cx = w / 2f;
            using (var pen = new Pen(Color.White, Math.Max(2f, w / 18f)))
            {
                pen.StartCap = LineCap.Round; pen.EndCap = LineCap.Round; pen.LineJoin = LineJoin.Round;
                float top = h * 0.24f, bottom = h * 0.52f;
                g.DrawLine(pen, cx, top, cx, bottom);
                g.DrawLine(pen, cx - w * 0.12f, bottom - h * 0.12f, cx, bottom);
                g.DrawLine(pen, cx + w * 0.12f, bottom - h * 0.12f, cx, bottom);
                float ty = h * 0.62f;
                g.DrawLine(pen, cx - w * 0.24f, ty, cx - w * 0.24f, ty + h * 0.1f);
                g.DrawLine(pen, cx - w * 0.24f, ty + h * 0.1f, cx + w * 0.24f, ty + h * 0.1f);
                g.DrawLine(pen, cx + w * 0.24f, ty + h * 0.1f, cx + w * 0.24f, ty);
            }
            if (Width >= 80)
            {
                using (var f = new Font("Segoe UI", Math.Max(6f, Width / 11f), FontStyle.Bold, GraphicsUnit.Pixel))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                    g.DrawString("Planner", f, Brushes.White, new RectangleF(0, h * 0.74f, w, h * 0.16f), sf);
            }
        }

        /* --- Maus: ziehen, Größe, Doppelklick --- */

        protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Left) { moving = true; moved = false; moveStart = Cursor.Position; moveOrigin = Location; }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (moving)
            {
                var p = Cursor.Position;
                int dx = p.X - moveStart.X, dy = p.Y - moveStart.Y;
                if (!moved && Math.Abs(dx) < 3 && Math.Abs(dy) < 3) return;
                moved = true;
                Location = new Point(moveOrigin.X + dx, moveOrigin.Y + dy);
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button == MouseButtons.Left && moving)
            {
                moving = false;
                if (moved) { SavePosition(); lastClick = DateTime.MinValue; return; }
                // Eigene Doppelklick-Erkennung: zwei Klicks ohne Bewegung innerhalb der Windows-Doppelklickzeit
                var now = DateTime.Now;
                if ((now - lastClick).TotalMilliseconds <= SystemInformation.DoubleClickTime)
                {
                    lastClick = DateTime.MinValue;
                    OpenTask(new List<DroppedFile>());
                }
                else lastClick = now;
            }
        }
        DateTime lastClick = DateTime.MinValue;

        protected override void OnMouseDoubleClick(MouseEventArgs e)
        {
            base.OnMouseDoubleClick(e);
            // wird zusätzlich von OnMouseUp abgedeckt; hier nur, falls Windows den Doppelklick direkt meldet
        }

        protected override void OnMouseWheel(MouseEventArgs e)
        {
            base.OnMouseWheel(e);
            int step = e.Delta > 0 ? 8 : -8;
            SetPointSize(Width + step);
        }

        void SetPointSize(int size)
        {
            size = Clamp(size, 56, 400);
            var center = new Point(Left + Width / 2, Top + Height / 2);
            ClientSize = new Size(size, size);
            Location = new Point(center.X - size / 2, center.Y - size / 2);
            App.Cfg.Size = size;
            SavePosition();
        }

        void SavePosition() { App.Cfg.X = Left; App.Cfg.Y = Top; App.Cfg.Save(); }

        static int Clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }

        /* --- Drag & Drop --- */

        protected override void OnDragEnter(DragEventArgs e)
        {
            base.OnDragEnter(e);
            if (Dropped.HasFiles(e.Data)) { e.Effect = DragDropEffects.Copy; dragOver = true; Invalidate(); }
            else e.Effect = DragDropEffects.None;
        }

        protected override void OnDragLeave(EventArgs e) { base.OnDragLeave(e); dragOver = false; Invalidate(); }

        protected override void OnDragDrop(DragEventArgs e)
        {
            base.OnDragDrop(e);
            dragOver = false; Invalidate();
            string dir = Path.Combine(App.LocalDir, "drop", Guid.NewGuid().ToString("N"));
            List<DroppedFile> files;
            Cursor = Cursors.WaitCursor;
            try { files = Dropped.Extract(e.Data, dir); }
            catch (Exception ex)
            {
                App.Log("Drop: " + ex);
                MessageBox.Show("Die Datei konnte nicht übernommen werden:\n" + ex.Message, "Planner-Ablage", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            finally { Cursor = Cursors.Default; }
            if (files.Count == 0)
            {
                MessageBox.Show("Hier kam keine Datei an.\n\nAus dem neuen Outlook bitte die Mail zuerst auf den Desktop ziehen und dann die Datei hier ablegen. Ordner werden nicht übernommen.",
                    "Planner-Ablage", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            OpenTask(files, dir);
        }

        void OpenTask(List<DroppedFile> files) { OpenTask(files, Path.Combine(App.LocalDir, "drop", Guid.NewGuid().ToString("N"))); }

        void OpenTask(List<DroppedFile> files, string dir)
        {
            try { Directory.CreateDirectory(dir); } catch (Exception) { }
            var win = new TaskWindow(files, dir);
            // neben dem Punkt platzieren, auf dem Bildschirm des Punkts
            var sc = Screen.FromControl(this).WorkingArea;
            int w = Math.Min(App.Cfg.FormWidth, sc.Width), h = Math.Min(App.Cfg.FormHeight, sc.Height);
            int x = Right + 12; if (x + w > sc.Right) x = Left - 12 - w; if (x < sc.Left) x = sc.Left;
            int y = Top; if (y + h > sc.Bottom) y = sc.Bottom - h; if (y < sc.Top) y = sc.Top;
            win.StartPosition = FormStartPosition.Manual;
            win.Bounds = new Rectangle(x, y, w, h);
            win.Show();
            win.Activate();
        }
    }

    /* ---------- Formularfenster mit WebView2 ---------- */

    class TaskWindow : Form
    {
        readonly List<DroppedFile> files;
        readonly string dir;
        WebView2 wv;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        Label status;

        public TaskWindow(List<DroppedFile> files, string dir)
        {
            this.files = files; this.dir = dir;
            Text = files.Count == 0 ? "Aufgabe in Planner" : "Aufgabe in Planner – " + files[0].Name + (files.Count > 1 ? " (+" + (files.Count - 1) + ")" : "");
            MinimumSize = new Size(360, 520);
            ShowInTaskbar = true;
            TopMost = App.Cfg.TopMost;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
            status = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, Text = "Formular wird geladen …", ForeColor = Color.DimGray, Font = new Font("Segoe UI", 10f) };
            Controls.Add(status);
            wv = new WebView2 { Dock = DockStyle.Fill, Visible = false };
            Controls.Add(wv);
            Load += async delegate { await InitAsync(); };
            Shown += delegate
            {
                // Dateien im Hintergrund in den Übergabeordner kopieren, während der Nutzer schon ausfüllt
                if (files.Exists(f => !f.Ready)) Task.Run(new Action(CopyPending));
            };
            FormClosed += delegate
            {
                try { App.Cfg.FormWidth = Width; App.Cfg.FormHeight = Height; App.Cfg.Save(); } catch (Exception) { }
                try { if (Directory.Exists(dir)) Directory.Delete(dir, true); } catch (Exception) { }
            };
        }

        async Task InitAsync()
        {
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(App.LocalDir, "WebView2"), null);
                await wv.EnsureCoreWebView2Async(env);
                var core = wv.CoreWebView2;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = true;
                core.SetVirtualHostNameToFolderMapping("ablage.local", dir, CoreWebView2HostResourceAccessKind.Allow);

                string url = App.Cfg.PageUrl;
                if (File.Exists(url))
                {
                    // Entwicklung: lokale index.html als https://planner-ablage.local/... einblenden
                    core.SetVirtualHostNameToFolderMapping("planner-ablage.local", Path.GetDirectoryName(url), CoreWebView2HostResourceAccessKind.Allow);
                    url = "https://planner-ablage.local/" + Path.GetFileName(url);
                }

                core.WebMessageReceived += OnMessage;
                core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e)
                {
                    e.Handled = true;
                    try { Process.Start(e.Uri); } catch (Exception) { }
                };
                core.NavigationCompleted += delegate(object s, CoreWebView2NavigationCompletedEventArgs e)
                {
                    if (!e.IsSuccess) { status.Text = "Seite konnte nicht geladen werden (" + e.WebErrorStatus + ").\n" + App.Cfg.PageUrl; status.Visible = true; wv.Visible = false; }
                    else { status.Visible = false; wv.Visible = true; }
                };
                // Zeitstempel anhängen, damit WebView2 nie eine veraltete index.html aus dem Cache nimmt
                if (url.StartsWith("http")) url += (url.Contains("?") ? "&" : "?") + "t=" + DateTime.UtcNow.Ticks;
                core.Navigate(url);
            }
            catch (Exception ex)
            {
                App.Log("WebView2: " + ex);
                status.Text = "Die Microsoft Edge WebView2-Laufzeit fehlt oder konnte nicht gestartet werden.\n\n" + ex.Message;
            }
        }

        void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var msg = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson);
                if (msg == null || !msg.ContainsKey("type")) return;
                string type = Convert.ToString(msg["type"]);
                switch (type)
                {
                    case "ready": SendFiles(); break;
                    case "close": Close(); break;
                    case "done": Text = "Aufgabe angelegt"; break;
                    case "open":
                        if (msg.ContainsKey("url")) { try { Process.Start(Convert.ToString(msg["url"])); } catch (Exception) { } }
                        break;
                    case "log": App.Log("Seite: " + (msg.ContainsKey("text") ? Convert.ToString(msg["text"]) : "")); break;
                }
            }
            catch (Exception ex) { App.Log("Nachricht: " + ex.Message); }
        }

        void CopyPending()
        {
            foreach (var f in files)
            {
                if (f.Ready) continue;
                try
                {
                    Directory.CreateDirectory(dir);
                    File.Copy(f.OriginalPath, Path.Combine(dir, f.TempName), true);
                    f.Size = new FileInfo(Path.Combine(dir, f.TempName)).Length;
                }
                catch (Exception ex) { f.Error = ex.Message; App.Log("Kopieren " + f.Name + ": " + ex.Message); }
                f.Ready = true;
                try { if (IsHandleCreated) BeginInvoke(new Action(SendFiles)); } catch (Exception) { }
            }
        }

        void SendFiles()
        {
            if (wv == null || wv.CoreWebView2 == null || IsDisposed) return;
            var list = new List<Dictionary<string, object>>();
            foreach (var f in files)
            {
                var d = new Dictionary<string, object>();
                d["name"] = f.Name;
                d["url"] = (f.Ready && f.Error == null) ? "https://ablage.local/" + Uri.EscapeDataString(f.TempName) : "";
                d["size"] = f.Size;
                d["path"] = f.OriginalPath ?? "";
                d["ready"] = f.Ready;
                d["error"] = f.Error ?? "";
                list.Add(d);
            }
            var m = new Dictionary<string, object>();
            m["type"] = "files"; m["version"] = App.Version; m["files"] = list;
            wv.CoreWebView2.PostWebMessageAsJson(json.Serialize(m));
        }
    }

    /* ---------- Abgelegte Dateien einsammeln ---------- */

    class DroppedFile
    {
        public string Name;          // Anzeigename (Original)
        public string TempName;      // Dateiname im Übergabeordner
        public string OriginalPath;  // Herkunft (nur zur Projekterkennung, wird nirgends gespeichert)
        public long Size;
        public bool Ready;           // Kopie im Übergabeordner liegt vor
        public string Error;         // Kopieren fehlgeschlagen
    }

    static class Dropped
    {
        public static bool HasFiles(System.Windows.Forms.IDataObject data)
        {
            return data.GetDataPresent(DataFormats.FileDrop) || data.GetDataPresent("FileGroupDescriptorW");
        }

        public static List<DroppedFile> Extract(System.Windows.Forms.IDataObject data, string dir)
        {
            Directory.CreateDirectory(dir);
            var out_ = new List<DroppedFile>();

            if (data.GetDataPresent(DataFormats.FileDrop))
            {
                var paths = data.GetData(DataFormats.FileDrop) as string[];
                if (paths != null)
                    foreach (var p in paths)
                    {
                        if (!File.Exists(p)) continue; // Ordner werden nicht übernommen
                        string name = Path.GetFileName(p);
                        string temp = UniqueName(dir, name, out_);
                        long size = 0; try { size = new FileInfo(p).Length; } catch (Exception) { }
                        // Kopiert wird erst im Hintergrund (TaskWindow), damit das Formular sofort aufgeht
                        out_.Add(new DroppedFile { Name = name, TempName = temp, OriginalPath = p, Size = size, Ready = false });
                    }
                if (out_.Count > 0) return out_;
            }

            if (data.GetDataPresent("FileGroupDescriptorW"))
            {
                // Virtuelle Dateien (klassisches Outlook: Mails als .msg, Anhänge)
                var names = VirtualFiles.GetNames(data);
                var com = data as System.Runtime.InteropServices.ComTypes.IDataObject;
                if (com != null)
                    for (int i = 0; i < names.Length; i++)
                    {
                        string name = Sanitize(names[i]);
                        if (string.IsNullOrEmpty(name)) name = "Mail_" + (i + 1) + ".msg";
                        string temp = UniqueName(dir, name, out_);
                        string dest = Path.Combine(dir, temp);
                        // Muss sofort passieren: das Datenobjekt von Outlook gilt nur während des Drops
                        if (VirtualFiles.SaveContents(com, i, dest) && File.Exists(dest))
                            out_.Add(new DroppedFile { Name = name, TempName = temp, OriginalPath = "", Size = new FileInfo(dest).Length, Ready = true });
                    }
            }
            return out_;
        }

        static string Sanitize(string name)
        {
            if (name == null) return "";
            foreach (char c in Path.GetInvalidFileNameChars()) name = name.Replace(c, '_');
            return name.Trim();
        }

        static string UniqueName(string dir, string name, List<DroppedFile> taken)
        {
            name = Sanitize(name);
            if (string.IsNullOrEmpty(name)) name = "Datei";
            string candidate = name; int n = 2;
            while (File.Exists(Path.Combine(dir, candidate)) || taken.Exists(f => string.Equals(f.TempName, candidate, StringComparison.OrdinalIgnoreCase)))
                candidate = Path.GetFileNameWithoutExtension(name) + " (" + (n++) + ")" + Path.GetExtension(name);
            return candidate;
        }
    }

    /* Outlook liefert beim Ziehen keine Pfade, sondern "virtuelle Dateien"
     * (CFSTR_FILEDESCRIPTORW + CFSTR_FILECONTENTS als IStream oder IStorage). */
    static class VirtualFiles
    {
        const int DescriptorSize = 592, NameOffset = 72, NameBytes = 520;

        public static string[] GetNames(System.Windows.Forms.IDataObject data)
        {
            var ms = data.GetData("FileGroupDescriptorW") as MemoryStream;
            if (ms == null) return new string[0];
            byte[] b = ms.ToArray();
            if (b.Length < 4) return new string[0];
            int count = BitConverter.ToInt32(b, 0);
            if (count < 0 || 4 + count * DescriptorSize > b.Length) count = Math.Max(0, (b.Length - 4) / DescriptorSize);
            var names = new string[count];
            for (int i = 0; i < count; i++)
            {
                string s = Encoding.Unicode.GetString(b, 4 + i * DescriptorSize + NameOffset, NameBytes);
                int nul = s.IndexOf('\0');
                names[i] = nul >= 0 ? s.Substring(0, nul) : s;
            }
            return names;
        }

        public static bool SaveContents(System.Runtime.InteropServices.ComTypes.IDataObject com, int index, string dest)
        {
            var fmt = new FORMATETC();
            fmt.cfFormat = (short)DataFormats.GetFormat("FileContents").Id;
            fmt.dwAspect = DVASPECT.DVASPECT_CONTENT;
            fmt.lindex = index;
            fmt.ptd = IntPtr.Zero;
            fmt.tymed = TYMED.TYMED_ISTREAM | TYMED.TYMED_ISTORAGE;
            STGMEDIUM medium;
            try { com.GetData(ref fmt, out medium); }
            catch (Exception e) { App.Log("FileContents " + index + ": " + e.Message); return false; }
            try
            {
                if (medium.tymed == TYMED.TYMED_ISTREAM && medium.unionmember != IntPtr.Zero)
                {
                    var stream = (IStream)Marshal.GetObjectForIUnknown(medium.unionmember);
                    try { CopyStream(stream, dest); } finally { Marshal.ReleaseComObject(stream); }
                    return true;
                }
                if (medium.tymed == TYMED.TYMED_ISTORAGE && medium.unionmember != IntPtr.Zero)
                {
                    var src = (IStorage)Marshal.GetObjectForIUnknown(medium.unionmember);
                    IStorage dst = null;
                    try
                    {
                        int hr = StgCreateDocfile(dest, STGM_READWRITE | STGM_SHARE_EXCLUSIVE | STGM_CREATE, 0, out dst);
                        if (hr != 0) throw new COMException("StgCreateDocfile", hr);
                        src.CopyTo(0, IntPtr.Zero, IntPtr.Zero, dst);
                        dst.Commit(0);
                    }
                    finally
                    {
                        if (dst != null) Marshal.ReleaseComObject(dst);
                        Marshal.ReleaseComObject(src);
                    }
                    return true;
                }
                return false;
            }
            finally { ReleaseStgMedium(ref medium); }
        }

        static void CopyStream(IStream stream, string dest)
        {
            var buf = new byte[1 << 16];
            IntPtr pRead = Marshal.AllocHGlobal(4);
            try
            {
                using (var fs = new FileStream(dest, FileMode.Create, FileAccess.Write))
                {
                    while (true)
                    {
                        stream.Read(buf, buf.Length, pRead);
                        int n = Marshal.ReadInt32(pRead);
                        if (n <= 0) break;
                        fs.Write(buf, 0, n);
                    }
                }
            }
            finally { Marshal.FreeHGlobal(pRead); }
        }

        const uint STGM_READWRITE = 0x2, STGM_SHARE_EXCLUSIVE = 0x10, STGM_CREATE = 0x1000;

        [DllImport("ole32.dll")]
        static extern int StgCreateDocfile([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, uint grfMode, uint reserved, out IStorage ppstgOpen);

        [DllImport("ole32.dll")]
        static extern void ReleaseStgMedium(ref STGMEDIUM pmedium);

        [ComImport, Guid("0000000B-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IStorage
        {
            void CreateStream([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, uint grfMode, uint reserved1, uint reserved2, out IStream ppstm);
            void OpenStream([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, IntPtr reserved1, uint grfMode, uint reserved2, out IStream ppstm);
            void CreateStorage([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, uint grfMode, uint reserved1, uint reserved2, out IStorage ppstg);
            void OpenStorage([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, IStorage pstgPriority, uint grfMode, IntPtr snbExclude, uint reserved, out IStorage ppstg);
            void CopyTo(uint ciidExclude, IntPtr rgiidExclude, IntPtr snbExclude, IStorage pstgDest);
            void MoveElementTo([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, IStorage pstgDest, [MarshalAs(UnmanagedType.LPWStr)] string pwcsNewName, uint grfFlags);
            void Commit(uint grfCommitFlags);
            void Revert();
            void EnumElements(uint reserved1, IntPtr reserved2, uint reserved3, out IntPtr ppenum);
            void DestroyElement([MarshalAs(UnmanagedType.LPWStr)] string pwcsName);
            void RenameElement([MarshalAs(UnmanagedType.LPWStr)] string pwcsOldName, [MarshalAs(UnmanagedType.LPWStr)] string pwcsNewName);
            void SetElementTimes([MarshalAs(UnmanagedType.LPWStr)] string pwcsName, IntPtr pctime, IntPtr patime, IntPtr pmtime);
            void SetClass(ref Guid clsid);
            void SetStateBits(uint grfStateBits, uint grfMask);
            void Stat(out System.Runtime.InteropServices.ComTypes.STATSTG pstatstg, uint grfStatFlag);
        }
    }

    /* ---------- DPI: scharf auf hochauflösenden Bildschirmen ---------- */

    static class Dpi
    {
        [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
        static readonly IntPtr PerMonitorAwareV2 = new IntPtr(-4);

        public static void Enable()
        {
            try { if (SetProcessDpiAwarenessContext(PerMonitorAwareV2)) return; } catch (Exception) { }
            try { SetProcessDPIAware(); } catch (Exception) { }
        }
    }

    /* ---------- Autostart über den Benutzer-Startordner (kein Admin nötig) ---------- */

    static class Autostart
    {
        static string LinkPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "Planner-Ablage.lnk"); }
        }

        public static bool IsEnabled() { return File.Exists(LinkPath); }

        public static void Set(bool on)
        {
            try
            {
                if (!on) { if (File.Exists(LinkPath)) File.Delete(LinkPath); return; }
                var shellType = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(shellType);
                object link = shellType.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { LinkPath });
                var lt = link.GetType();
                lt.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, link, new object[] { Application.ExecutablePath });
                lt.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, link, new object[] { Path.GetDirectoryName(Application.ExecutablePath) });
                lt.InvokeMember("Description", System.Reflection.BindingFlags.SetProperty, null, link, new object[] { "Planner-Ablage: Datei ablegen, Aufgabe in Planner anlegen" });
                lt.InvokeMember("IconLocation", System.Reflection.BindingFlags.SetProperty, null, link, new object[] { Application.ExecutablePath + ",0" });
                lt.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, link, null);
            }
            catch (Exception e)
            {
                App.Log("Autostart: " + e.Message);
                MessageBox.Show("Autostart konnte nicht gesetzt werden:\n" + e.Message, "Planner-Ablage", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
