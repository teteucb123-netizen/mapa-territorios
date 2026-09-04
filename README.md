# Mapa de Territórios

Sistema web focado em duas telas: um **mapa interativo** com a área de atuação já traçada, mostrando bairros, sub-bairros e ruas identificados a partir de dados geográficos reais (OpenStreetMap), e uma tela de **distâncias entre bairros**, já calculadas e armazenadas. Sem login — abre direto.

## O que o sistema faz

- Mapa interativo (OpenStreetMap/Leaflet): zoom, scroll, arrastar, pesquisar, tudo padrão de mapa profissional.
- Área de atuação pré-traçada (reconstrução aproximada da área de referência informada) — pode ser redesenhada se precisar ajustar.
- Botão **"Identificar bairros e ruas"**: consulta a Overpass API (OpenStreetMap) e descobre automaticamente os bairros, sub-bairros e ruas nomeadas dentro da área traçada — nada é cadastrado manualmente.
- Painel lateral integrado ao mapa com a árvore Bairro → Sub-bairro → Rua; clicar em qualquer item localiza e destaca no mapa. Clicar num elemento no mapa destaca o item correspondente na lista (interação nos dois sentidos).
- Ruas só aparecem a partir de um certo nível de zoom, para não poluir a visão geral.
- Distâncias entre bairros: calculadas **uma vez**, no momento da identificação, e guardadas no banco — a tela de consulta só lê esses dados, nunca recalcula na hora. Tem lista, visão "por bairro" (ordenado do mais perto ao mais longe), matriz completa e busca rápida origem→destino. Clicar numa distância volta pro mapa, centraliza e destaca os dois bairros com uma linha conectando eles.

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend + Backend | Next.js 16 + TypeScript | Um único projeto, simples de publicar |
| Mapa | Leaflet + OpenStreetMap | Gratuito, sem chave de API |
| Identificação de bairros/ruas | Overpass API (OpenStreetMap) | Dados geográficos reais, gratuito |
| Geocodificação (busca) | Nominatim (OSM) | Gratuito |
| Distância por estrada | OSRM (calculado uma vez, na identificação) | Gratuito |
| Banco de dados | SQLite (`better-sqlite3`) | Arquivo único, zero configuração |

Todos os serviços OSM acima são servidores públicos gratuitos, sem SLA. Para volume maior, hospede sua própria instância (Overpass, OSRM, Nominatim são todos open source) e troque as URLs em `.env` — nada mais no código precisa mudar.

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:3000. Na primeira vez, clique em "Identificar bairros e ruas" no painel lateral do mapa para popular os dados.

## Publicando online

Precisa de disco persistente (o banco é um arquivo SQLite). Recomendado: **Railway** — crie um projeto a partir do repositório, adicione um volume montado em `/data`, defina `DB_PATH=/data/app.db` nas variáveis, e pronto. Alternativas: Render ou uma VPS com `npm run build && npm run start` atrás de um proxy reverso.

## Estrutura

```
src/
  app/
    page.tsx                 # Mapa (com painel lateral) e Distâncias entre Bairros
    api/
      areas/                 # área traçada (GET/POST/PUT)
      discover/               # identificação via Overpass (POST) — substitui todo dado
      regions/  units/        # bairros/sub-bairros e ruas (somente leitura)
      bairro-distances/       # distâncias já calculadas (somente leitura)
      geocode/  distance/     # geocodificação e distância ponto-a-ponto (usadas pela busca)
  components/
    MapView.tsx               # mapa Leaflet
    BairrosPanel.tsx          # árvore lateral Bairro → Sub-bairro → Rua
    DistanciasPanel.tsx       # lista / por-bairro / matriz / busca
  lib/
    db.ts                     # schema SQLite + área pré-semeada
    routing.ts                 # OSRM, Nominatim e Overpass
```

## O que foi removido de propósito

Regiões/Unidades como cadastro manual, Equipes, Rotas, Dashboard, Ordens de Serviço e login não fazem parte deste sistema — o foco é só o mapa e as distâncias entre bairros, com os dados vindo de fontes geográficas reais em vez de cadastro manual.
