KersSecure C# Lua Engine

Standalone .NET 8 Lua syntax-validation CLI using the MoonSharp parser.

Usage:
- dotnet build KersSecure.Engine/KersSecure.Engine.csproj -c Release
- dotnet run --project KersSecure.Engine -- validate input.lua

The C# AST transformation and VM protection passes are not implemented. The CLI deliberately refuses to produce an obfuscated file rather than output unsafe or misleading content. Luau syntax is not supported by MoonSharp.
