using System.Security.Cryptography;
using System.Text;
using MoonSharp.Interpreter;
if (args.Length < 2 || args[0] is not ("validate" or "obfuscate")) { Console.Error.WriteLine("Usage: KersSecure.Engine <validate|obfuscate> <input.lua> [output.lua]"); return 2; }
var source = await File.ReadAllTextAsync(args[1]);
try { var script = new Script(CoreModules.Preset_Complete); _ = script.LoadString(source, null, args[1]); }
catch (SyntaxErrorException ex) { Console.Error.WriteLine($"Syntax validation failed: {ex.DecoratedMessage}"); return 3; }
if (args[0] == "validate") { Console.WriteLine("Lua syntax valid (MoonSharp parser)."); return 0; }
if (args.Length < 3) { Console.Error.WriteLine("An output file is required for obfuscate."); return 2; }
var minified = Minify(source);
await File.WriteAllTextAsync(args[2], minified, new UTF8Encoding(false));
Console.WriteLine($"Build written: {args[2]} ({Encoding.UTF8.GetByteCount(minified)} bytes)");
return 0;
static string Minify(string input) {
 var output = new StringBuilder(input.Length); bool single=false,dbl=false,lineComment=false,escape=false,pendingSpace=false;
 for(int i=0;i<input.Length;i++){char c=input[i]; if(lineComment){if(c=='\\n'){lineComment=false;pendingSpace=true;}continue;} if(!single&&!dbl&&c=='-'&&i+1<input.Length&&input[i+1]=='-'){lineComment=true;i++;continue;} if(!single&&c=='\\''&&!escape)single=!single;else if(!single&&c=='\"'&&!escape)dbl=!dbl; if(char.IsWhiteSpace(c)&&!single&&!dbl){pendingSpace=true;continue;} if(pendingSpace&&output.Length>0&&IsWord(output[^1])&&IsWord(c))output.Append(' ');pendingSpace=false;output.Append(c);if(c=='\\\\'&&(single||dbl)&&!escape)escape=true;else escape=false; }
 return output.ToString();
}
static bool IsWord(char c)=>char.IsLetterOrDigit(c)||c=='_';
