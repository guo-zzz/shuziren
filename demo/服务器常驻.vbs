' ============================================================
'  Hidden launcher for the Digital-Human demo server.
'  Used by the logon scheduled task "DigitalHumanDemoServer".
'  Keep this file in GBK/ANSI encoding on Windows.
' ============================================================
Option Explicit
Dim sh, fso, here, target
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(here, "·þÎñÆ÷³£×¤.bat")
' 0 = hidden window, False = do not wait
sh.Run """" & target & """", 0, False