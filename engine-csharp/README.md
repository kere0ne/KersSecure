KersSecure C# Lua Engine

Standalone .NET 8 CLI. MoonSharp parses Lua source before any build output is written.

Usage:
- dotnet build KersSecure.Engine/KersSecure.Engine.csproj -c Release
- dotnet run --project KersSecure.Engine -- validate input.lua
- dotnet run --project KersSecure.Engine -- obfuscate input.lua output.lua

Current implementation provides parser-backed Lua syntax validation and syntax-preserving minification. It does NOT yet implement Luau parsing, lexical-scope binding analysis, control-flow flattening, or VM virtualization. Do not advertise those passes as available until implemented and regression-tested.
