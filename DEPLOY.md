# 🚀 Guia de Deploy - Bisca Ranked V2

## Opções de Deploy Gratuitas

### 1️⃣ Railway.app (RECOMENDADO ⭐)

**Por quê Railway?**
- ✅ Suporta SQLite nativamente
- ✅ Deploy em 1 clique do GitHub
- ✅ Plano gratuito generoso ($5/mês)
- ✅ Muito fácil de usar
- ✅ Domínio customizável

**Como fazer:**

```bash
# 1. Push seu código para GitHub
git push origin main

# 2. Acesse railway.app
# 3. Faça login com GitHub
# 4. New Project → Deploy from GitHub repo
# 5. Selecione seu repositório
# 6. Railway detecta automaticamente Node.js
# 7. Pronto! App no ar em ~2 minutos
```

**Seu app estará em:** `https://seu-app-name.up.railway.app`

---

### 2️⃣ Heroku

**Como fazer:**

```bash
# 1. Instale Heroku CLI
# Acesse: https://devcenter.heroku.com/articles/heroku-cli

# 2. Faça login
heroku login

# 3. Crie o app
heroku create seu-app-name

# 4. Deploy
git push heroku main

# 5. Veja os logs
heroku logs --tail
```

**Seu app estará em:** `https://seu-app-name.herokuapp.com`

---

### 3️⃣ Render.com

**Como fazer:**

```
1. Acesse render.com
2. Nova Web Service
3. Conecte seu repositório GitHub
4. Configure:
   - Build Command: npm install
   - Start Command: npm start
5. Deploy automático!
```

**Seu app estará em:** `https://seu-app-name.onrender.com`

---

### 4️⃣ Seu Próprio Servidor (VPS/Servidor Dedicado)

**Usando PM2 (Node.js Process Manager):**

```bash
# 1. SSH no servidor
ssh usuario@seu-servidor.com

# 2. Clone o repositório
git clone https://github.com/seu-user/bisca-ranked.git
cd bisca-ranked

# 3. Instale dependências
npm install

# 4. Instale PM2 globalmente
npm install -g pm2

# 5. Inicie o app
pm2 start server/index.js --name bisca-ranked

# 6. Salve a configuração
pm2 save
pm2 startup

# 7. Configure Nginx como proxy reverso (opcional mas recomendado)
```

**Configuração Nginx (opcional):**

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### 5️⃣ Docker (Para deploy em qualquer lugar)

**Crie `Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**Deploy com Docker:**

```bash
# Build
docker build -t bisca-ranked .

# Run localmente
docker run -p 3000:3000 bisca-ranked

# Push para Docker Hub e deploy em qualquer lugar
```

---

## 📊 Comparação de Plataformas

| Plataforma | Custo | Facilidade | SQLite | Uptime | Recomendação |
|-----------|-------|-----------|--------|--------|--------------|
| Railway   | $5/mês | ⭐⭐⭐⭐⭐ | ✅ | 99.9% | ⭐⭐⭐⭐⭐ |
| Render    | Grátis/pago | ⭐⭐⭐⭐ | ✅ | 99.5% | ⭐⭐⭐⭐ |
| Heroku    | Grátis/pago | ⭐⭐⭐⭐ | ⚠️ Limitado | 99.5% | ⭐⭐⭐ |
| VPS       | $5-20/mês | ⭐⭐ | ✅ | 99.9%+ | ⭐⭐⭐ |
| Docker    | Varia | ⭐⭐⭐ | ✅ | Varia | ⭐⭐⭐⭐ |

---

## 🎯 Passos Finais Após Deploy

1. **Teste o app**
   ```
   Acesse seu domínio no navegador
   Crie um jogador de teste
   Registre uma partida
   ```

2. **Configure domínio customizado**
   ```
   Railway → Custom Domain
   Apontar DNS para o domínio da plataforma
   ```

3. **Enable HTTPS**
   ```
   Automático em Railway, Render e Heroku ✅
   ```

4. **Monitoramento**
   ```
   Railway/Render/Heroku: Dashboard automático
   VPS: Use Uptime Robot (uptimerobot.com)
   ```

5. **Backup automático**
   ```bash
   # Adicione backup diário na sua VPS
   # Cron job que copia data/bisca.db
   ```

---

## 🔄 CI/CD (Deploy Automático)

**GitHub Actions** - Deploy automático quando fizer push:

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Railway
        uses: railwayapp/deploy-action@v1
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 💾 Backup e Restauração

**Backup automático em Railway:**

```bash
# Configurar backup mensal
# Dashboard Railway → Settings → Auto Backup
```

**Restauração manual:**

```bash
# Download do banco
railway download data/bisca.db

# Upload novo
railway upload data/bisca.db
```

---

## 🆘 Troubleshooting

**App não inicia:**
```bash
npm run dev  # Teste localmente primeiro
# Verifique logs da plataforma
heroku logs --tail
```

**Banco de dados corrompido:**
```bash
# Delete e recrie
rm data/bisca.db
npm run dev  # Cria novo banco automaticamente
```

**Porta não responde:**
```bash
# Verifique se está rodando
pm2 list
pm2 logs bisca-ranked
```

---

**🎉 Parabéns! Seu Bisca Ranked está no ar!**

Compartilhe com seus amigos: seu-dominio.com
