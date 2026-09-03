# Mapa de Territórios

Sistema web para mapear regiões de atuação, cadastrar unidades/pontos estratégicos, calcular distâncias e planejar rotas — sem login, acesso direto pelo navegador.

## O que está implementado (MVP)

- Mapa interativo (OpenStreetMap) com zoom, navegação e busca de endereço
- Desenho da área de atuação da empresa (polígono)
- Cadastro de regiões, cada uma com nome, código, cor, responsável, equipe e limite geográfico desenhado no mapa
- Cadastro de unidades/pontos: endereço com geocodificação automática (ou clique direto no mapa), região, equipe, tipo, responsável, telefone
- Marcadores arrastáveis (mover unidade = arrastar no mapa)
- Cálculo de distância em linha reta e por estrada entre dois pontos (clique em dois marcadores no modo "Distâncias")
- Matriz de distâncias completa entre todas as unidades (ou filtradas por região) e entre todas as regiões (ponto central de cada uma)
- Planejamento de rota: escolha uma origem + destinos, o sistema sugere a melhor sequência de visita (otimização real via OSRM Trip, com fallback por proximidade se o serviço estiver fora do ar)
- Cadastro de equipes, vinculadas a regiões e unidades
- Dashboard: totais de regiões/unidades/equipes, unidades por região, região mais/menos próxima, distância média
- Filtros por região e cidade na lista de unidades
- Dados salvos em banco de dados real (SQLite) — persistem após fechar o navegador ou reiniciar o servidor
- Sem login: abrir a URL já leva direto ao sistema

**Ainda não implementado** (ficou fora do MVP para focar no essencial — ver "Próximos passos" no fim):
relatórios exportáveis (PDF/Excel/CSV), modo "Concentração" com mapa de calor, edição de vértice a vértice de polígonos já desenhados (hoje você redesenha o polígono inteiro para ajustar limites), controle de acesso/login (proposital, conforme pedido).

## Stack e por que essas escolhas

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend + Backend | Next.js 16 + TypeScript (App Router, API Routes) | Um único projeto para as duas pontas, simples de rodar e publicar |
| Mapa | Leaflet + OpenStreetMap | Gratuito, sem chave de API, sem cota de uso |
| Geocodificação | Nominatim (OSM) | Gratuito, sem chave de API |
| Rotas/distância por estrada | OSRM (servidor público de demonstração) | Gratuito; calcula matriz inteira em uma chamada e otimização real de sequência de visita (TSP) |
| Banco de dados | SQLite (`better-sqlite3`) | Banco real, arquivo único, zero configuração. Ver seção de deploy sobre persistência em produção |
| Estilo | Tailwind CSS | Produtividade e consistência visual |

**Sobre os serviços gratuitos (Nominatim/OSRM):** os servidores públicos têm limite de uso e não têm SLA — ótimos para o MVP e uso de baixo/médio volume. Se o volume crescer, duas opções sem reescrever nada: (1) hospedar sua própria instância OSRM/Nominatim (ambos open source) e trocar as URLs em `.env`; (2) trocar por Mapbox ou Google Maps — só os arquivos `src/lib/routing.ts` (rotas/geocodificação) e `src/components/MapView.tsx` (camada de mapa) precisariam mudar.

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:3000 — o banco SQLite é criado automaticamente em `./data/app.db` na primeira execução.

## Publicando online (para ter uma URL própria)

O sistema usa SQLite, um arquivo em disco. Isso funciona perfeitamente em qualquer host com **disco persistente** (as opções abaixo). Não use hospedagem 100% serverless (como o padrão do Vercel) sem adaptar o banco — o disco lá é apagado a cada execução; veja a alternativa no fim desta seção.

### Opção recomendada: Railway (mais simples)

1. Crie uma conta em [railway.app](https://railway.app) e clique em "New Project" → "Deploy from GitHub repo" (suba este projeto para um repositório GitHub antes).
2. A Railway detecta o Next.js automaticamente. Em "Variables", adicione `DB_PATH=/data/app.db`.
3. Em "Settings" → "Volumes", crie um volume e monte-o em `/data` — isso garante que o banco sobrevive a reinícios e novos deploys.
4. Deploy. A Railway te dá uma URL pública (`https://seuprojeto.up.railway.app`) — pode usar um domínio próprio depois em "Settings" → "Domains".

### Alternativa: Render, ou uma VPS

Mesma ideia: qualquer serviço com disco persistente funciona. Em uma VPS (ex.: um droplet da DigitalOcean/Hetzner), o processo é:

```bash
git clone <seu-repositorio>
cd mapa-territorios
npm install
npm run build
npm run start   # ou use pm2 para manter rodando em segundo plano
```

Depois, coloque um proxy reverso (Nginx ou Caddy) na frente para servir com HTTPS no seu domínio.

### Se preferir Vercel (serverless)

Funciona, mas o SQLite local **não persiste** entre execuções nesse modelo. Duas formas de resolver, sem reescrever a aplicação:
- Trocar `better-sqlite3` por um banco SQLite hospedado compatível com serverless, como o [Turso](https://turso.tech) (tem camada gratuita) — a mudança fica isolada em `src/lib/db.ts`.
- Ou migrar para PostgreSQL hospedado (ex.: [Neon](https://neon.tech), camada gratuita) — mais trabalho de adaptação das queries, mas é o caminho natural se o sistema crescer e for integrado à plataforma de Ordens de Serviço no futuro, como já é a arquitetura pensada.

## Estrutura do projeto

```
src/
  app/
    page.tsx              # aplicação (abas: Mapa, Regiões, Unidades, Equipes, Distâncias, Rotas, Dashboard)
    layout.tsx
    api/                  # rotas de backend (REST)
      areas/  regions/  units/  teams/  route-plan/
      geocode/  distance/  distance-matrix/  dashboard/
  components/              # MapView (Leaflet), painéis de cada aba, UI compartilhada
  lib/
    db.ts                  # conexão SQLite + schema
    geo.ts                 # haversine, centróide de polígono
    routing.ts              # integrações OSRM/Nominatim
    api-client.ts           # chamadas do frontend para a API
    types.ts / serializers.ts
data/
  app.db                   # banco SQLite (criado automaticamente, não versionado)
```

## Próximos passos (v2 / v3, conforme o roadmap original)

- Exportação de relatórios em PDF/Excel/CSV
- Modo de visualização "Concentração" (mapa de calor de unidades)
- Edição de vértices dos polígonos já desenhados (hoje é redesenhar o limite inteiro)
- App mobile / PWA
- Histórico de alterações e de deslocamentos
- Integração com plataforma de Ordens de Serviço: o fluxo já é direto a partir daqui — O.S. chega com endereço → `POST /api/geocode` localiza → o ponto mais próximo de cada região (`centroid_lat/lng`) indica a região → a equipe vinculada à região (`team_id`) é sugerida automaticamente → `POST /api/route-plan` sugere a rota
- Login e controle de acesso, se algum dia for necessário (hoje é proposital não ter)
