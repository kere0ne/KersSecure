using MoonSharp.Interpreter;
if (args.Length != 2 || args[0] != "validate")
{
    Console.Error.WriteLine("Usage: KersSecure.Engine validate <input.lua>");
    Console.Error.WriteLine("The C# obfuscation passes are not enabled yet; refusing to emit fake or unsafe output.");
    return 2;
}
var source = await File.ReadAllTextAsync(args[1]);
try
{
    var parser = new Script(CoreModules.Preset_Complete);
    _ = parser.LoadString(source, null, args[1]);
    Console.WriteLine("Lua syntax valid (MoonSharp parser).");
    return 0;
}
catch (SyntaxErrorException ex)
{
    Console.Error.WriteLine($"Syntax validation failed: {ex.DecoratedMessage}");
    return 3;
}
