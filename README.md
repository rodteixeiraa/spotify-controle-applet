# Spotify Controle

Um applet para o painel do Cinnamon que mostra a música atual do Spotify e oferece controles de reprodução.

## Recursos

- Nome da faixa no painel, com indicador de reprodução ou pausa.
- Controles para reproduzir, pausar e mudar de faixa.
- Disco de vinil animado no menu, com a capa da música no centro.
- Cores do painel e do menu inspiradas na capa, quando disponível.

## Requisitos

- Linux com ambiente de trabalho Cinnamon, como o Linux Mint Cinnamon.
- Aplicativo desktop do Spotify com suporte a MPRIS. A versão no navegador não é detectada.
- GdkPixbuf e libsoup 3 disponíveis no sistema.

O applet se comunica com o Spotify pelo D-Bus da sessão, sem login ou chave de API. A capa é obtida pela URL fornecida pelo Spotify; se não estiver disponível, um ícone aparece em seu lugar. Os controles disponíveis dependem das informações fornecidas pelo Spotify.

## Instalação

Baixe este repositório e, no terminal, dentro da pasta do projeto, execute:

```bash
mkdir -p ~/.local/share/cinnamon/applets
cp -r spotify-controle@applet ~/.local/share/cinnamon/applets/
```

Clique com o botão direito no painel, abra **Applets**, procure **Spotify Controle** e adicione-o ao painel. Abra o Spotify e clique no applet para acessar o menu.

Se ele não aparecer na lista, feche e abra novamente a janela de Applets. Se necessário, saia e entre novamente na sessão.

## Atualização

Copie novamente a pasta do applet com o mesmo comando da instalação. Para carregar a nova versão, reinicie o Cinnamon ou saia e entre novamente na sessão. No Cinnamon em uma sessão X11, você pode pressionar **Alt + F2**, digitar `r` e pressionar **Enter**.

## Desinstalação

Remova o applet do painel e execute:

```bash
rm -r ~/.local/share/cinnamon/applets/spotify-controle@applet
```
