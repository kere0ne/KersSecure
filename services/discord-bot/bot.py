import os
import httpx
import discord
from discord import app_commands
from discord.ext import commands
API_URL = os.environ['KERSSECURE_API_URL'].rstrip('/')
SERVICE_TOKEN = os.environ['KERSSECURE_SERVICE_TOKEN']
BOT_TOKEN = os.environ['DISCORD_BOT_TOKEN']
OWNER_IDS = {x.strip() for x in os.getenv('BOT_OWNER_IDS', '').split(',') if x.strip()}
intents = discord.Intents.default()
bot = commands.Bot(command_prefix='!', intents=intents)
def is_owner(interaction): return str(interaction.user.id) in OWNER_IDS
async def api(method, path, **kwargs):
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.request(method, API_URL + path, headers={'X-Service-Token': SERVICE_TOKEN}, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else {}
@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f'KersSecure bot ready as {bot.user}')
@bot.tree.command(name='generate', description='Generate a license key for a project')
@app_commands.describe(project_id='Project ID', days='Lifetime if omitted; otherwise days', max_devices='Allowed device count')
async def generate(interaction, project_id: str, days: app_commands.Range[int, 1, 3650] | None = None, max_devices: app_commands.Range[int, 1, 20] = 1):
    if not is_owner(interaction): return await interaction.response.send_message('Not allowed.', ephemeral=True)
    await interaction.response.defer(ephemeral=True)
    try:
        data = await api('POST', '/v1/keys', json={'project_id': project_id, 'expires_in_days': days, 'max_devices': max_devices})
        await interaction.followup.send(f"Generated key (shown once):\\n`{data['key']}`", ephemeral=True)
    except httpx.HTTPError: await interaction.followup.send('Key generation failed. Check project and API service.', ephemeral=True)
@bot.tree.command(name='keyinfo', description='View a key by internal key ID')
async def keyinfo(interaction, key_id: str):
    if not is_owner(interaction): return await interaction.response.send_message('Not allowed.', ephemeral=True)
    try:
        data = await api('GET', f'/v1/keys/{key_id}')
        await interaction.response.send_message(f"**{data['prefix']}** · {data['status']} · expires: {data['expires_at'] or 'never'}", ephemeral=True)
    except httpx.HTTPError: await interaction.response.send_message('Key not found.', ephemeral=True)
@bot.tree.command(name='revoke', description='Revoke a license by internal key ID')
async def revoke(interaction, key_id: str):
    if not is_owner(interaction): return await interaction.response.send_message('Not allowed.', ephemeral=True)
    try:
        await api('PATCH', f'/v1/keys/{key_id}', json={'status': 'REVOKED'})
        await interaction.response.send_message('License revoked.', ephemeral=True)
    except httpx.HTTPError: await interaction.response.send_message('Could not revoke that license.', ephemeral=True)
@bot.tree.command(name='reset-hwid', description='Reset all device bindings for a license')
async def reset_hwid(interaction, key_id: str):
    if not is_owner(interaction): return await interaction.response.send_message('Not allowed.', ephemeral=True)
    try:
        await api('POST', f'/v1/keys/{key_id}/reset-hwid')
        await interaction.response.send_message('Device bindings cleared.', ephemeral=True)
    except httpx.HTTPError: await interaction.response.send_message('HWID reset failed.', ephemeral=True)
bot.run(BOT_TOKEN)
