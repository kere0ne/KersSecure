import re, secrets
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from luaparser import ast
app = FastAPI(title='KersSecure Lua Obfuscation Engine', version='0.1.0')
class BuildRequest(BaseModel):
    source: str = Field(min_length=1, max_length=500_000)
    rename_locals: bool = True
    protect_strings: bool = True
    minify: bool = True
KEYWORDS = {'and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while'}
TOKEN = re.compile(r'''--\[\[.*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[.*?\]\]|[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\.\.\.?|==|~=|<=|>=|::|[^\s]''', re.S)
def lex(source): return TOKEN.findall(source)
def build(source, rename, strings, minify):
    try: ast.parse(source)
    except Exception as exc: raise HTTPException(422, detail=f'Lua syntax validation failed: {str(exc)[:240]}')
    tokens = lex(source)
    replacements = {}
    if rename:
        for i, token in enumerate(tokens[:-1]):
            if token == 'local' and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', tokens[i+1]) and tokens[i+1] not in KEYWORDS:
                replacements.setdefault(tokens[i+1], '_v' + secrets.token_hex(4))
        for i, token in enumerate(tokens):
            if token in replacements and (i == 0 or tokens[i-1] not in {'.', ':'}): tokens[i] = replacements[token]
    out = []
    for token in tokens:
        if token.startswith('--'): continue
        if strings and len(token) >= 2 and token[0] in {'\"', "'"} and token[-1] == token[0]:
            encoded = ','.join(str(b) for b in token[1:-1].encode('utf-8'))
            token = "(function()local t={" + encoded + "};local s='';for i=1,#t do s=s..string.char(t[i]) end;return s end)()"
        elif re.fullmatch(r'\d+', token) and int(token) > 1: token = f'({token}-1+1)'
        out.append(token)
    result = ' '.join(out)
    if minify:
        result = re.sub(r'\s+([,;)}\]])', r'\1', result)
        result = re.sub(r'([(\[{])\s+', r'\1', result)
    try: ast.parse(result)
    except Exception as exc: raise HTTPException(422, detail=f'Transformation output failed validation: {str(exc)[:240]}')
    return result
@app.get('/health')
def health(): return {'ok': True, 'engine': 'python-luaparser-validated'}
@app.post('/v1/build')
def create_build(body: BuildRequest):
    output = build(body.source, body.rename_locals, body.protect_strings, body.minify)
    return {'ok': True, 'engine': 'python-luaparser', 'output': output, 'input_bytes': len(body.source.encode()), 'output_bytes': len(output.encode())}
