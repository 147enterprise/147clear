# 147Clear

<img align="center" alt="GIF" src="https://i.imgur.com/jJCFzTJ.png">
<br>

147Clear é um script poderoso projetado para ajudar a gerenciar sua conta do Discord, com funções básicas para facilitar sua vida.

## Tabela de Conteúdos
- [Instalação](#instalação)
- [Uso](#uso)
- [Transformar em Executável](#transformar-em-executável)
- [Abrir um Commit](#abrir-um-commit)
- [Contato/Suporte](#contato)
- [Checklist de Futuras Adições](#checklist-de-futuras-adições)

## Instalação (requer [Node.js v22.11.0](https://nodejs.org/pt/blog/release/v22.11.0) e [Git](https://git-scm.com/downloads))
(caso queira pular a instalação, baixe o .exe clicando em "Atualização x.x.x" no lado direito nas Releases do repositório)

1. **Clone o repositório:**
    ```sh
    git clone https://github.com/147enterprise/147clear.git
    cd 147clear
    ```

2. **Instale as dependências:**
    ```sh
    npm install
    ```

## Uso

1. **Inicie o script:**
    ```sh
    node index.js
    ```

2. **Siga as instruções no terminal para navegar pelos menus e executar as ações desejadas.**

## Uso (Termux)

Leia o tutorial [clicando aqui](https://github.com/147enterprise/147clear/blob/termux/README.md).

## Como desativar o Rich Presence do Perfil?

1. Abra o Clear.

2. Logue na sua token e entre na opção Customizar.

3. Selecione a opção Ativar/Desativar o RPC.

## Transformar em Executável

Você pode transformar este script em um executável usando o `pkg`.

1. **Abra o CMD na pasta do projeto**

2. **Instale as dependências**
    ```sh
    npm install && npm install -g @yao-pkg/pkg
    ```

3. **Compile o script:**
    ```sh
    pkg .
    ```

4. **Execute o executável:**
    ```sh
    ./147clear.exe
    ```

## Abrir um Commit

Para contribuir com o projeto, siga estes passos:

1. **Crie um fork do repositório.**
2. **Clone seu fork:**
    ```sh
    git clone https://github.com/147enterprise/147clear.git
    cd 147clear
    ```

3. **Crie uma nova branch para suas alterações:**
    ```sh
    git checkout -b minha-nova-feature
    ```

4. **Faça suas alterações e adicione os arquivos modificados ao stage:**
    ```sh
    git add .
    ```

5. **Faça um commit com uma mensagem clara e concisa:**
    ```sh
    git commit -m "Adiciona nova feature"
    ```

6. **Envie suas alterações para o seu fork:**
    ```sh
    git push origin minha-nova-feature
    ```

7. **Abra um Pull Request no repositório original.**

## Contato

Para mais informações ou suporte, nos contate através do email: [147company@gmail.com](mailto:147company@gmail.com) ou abra uma Issue aqui no repositório.

## Checklist de Futuras Adições

- [x] Adição da função de Abrir DMs(Package/Amigos)
- [x] Adição do Trigger Clear para apagar mensagens com um comando.
- [x] Adição da função de clonar servidores.
- [x] Adição do KosameFarm.
- [ ] Adição de uma interface gráfica.
- [ ] Adição de atualizações automáticas.

---

**Aviso:** Este script é fornecido "como está", sem garantias de qualquer tipo. O uso deste script é de sua própria responsabilidade.

---

147enterprise © 2024. All Rights Reserved.
