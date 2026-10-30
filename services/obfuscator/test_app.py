from fastapi import HTTPException
import pytest
from app import build

def test_build_valid_lua_and_protect_plain_string():
    source = 'local message = "hello"\nprint(message)'
    output = build(source, False, True, True)
    assert 'string.char' in output
    assert output != source

def test_build_rejects_invalid_lua():
    with pytest.raises(HTTPException) as error:
        build('local =', False, True, True)
    assert error.value.status_code == 422

def test_scope_unsafe_renaming_fails_closed():
    with pytest.raises(HTTPException) as error:
        build('local x = 1; print(x)', True, True, True)
    assert error.value.status_code == 501
