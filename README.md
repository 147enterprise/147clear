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

## Instalação

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

1. **Instale o Git e o Node.js (caso ainda não tenha):**
    ```sh
    pkg install git
    pkg install nodejs
    ```

2. **Clone o repositório:**
    ```sh
    git clone https://github.com/147enterprise/147clear.git
    ```

3. **Adentre a pasta do repositório:**
    ```sh
    cd 147clear
    ```

4. **Instale as dependências:**
    ```sh
    npm install
    ```

5. **Inicie o script:**
    ```sh
    node index.js
    ```

6. **Siga as instruções no terminal para navegar pelos menus e executar as ações desejadas.**

## Como desativar o Rich Presence do Perfil?

1. Edite o arquivo `config.json` com um editor de texto.

2. Adicione a linha ao arquivo
   ```json
   "desativar_rpc": true,
   ```
   
3. O arquivo deve ficar mais ou menos assim:
  ```json
 {
    "tokens": [],
    "cor_painel": "#A020F0",
    "esperar_fetch": false,
    "desativar_rpc": true,
    "delay": "1",
    "kosame": {
        "ativado": false,
        "canal": "",
        "tokens": []
    }
}
```

4. Salve o arquivo e inicie o Clear novamente.

## Transformar em Executável

Você pode transformar este script em um executável usando o `pkg`.

1. **Abra o CMD na pasta do projeto**

2. **Instale as dependências**
    ```sh
    npm install && npm install -g @yao-pkg/pkg
    ```

3. **Compile o script:**
    ```sh
    pkg index.js
    ```

4. **Execute o executável:**
    ```sh
    ./index-*
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
- [ ] Adição de uma interface gráfica.
- [ ] Adição do KosameFarm.
- [ ] Adição de atualizações automáticas.
- [ ] Adição da função de clonar servidores.

---

**Aviso:** Este script é fornecido "como está", sem garantias de qualquer tipo. O uso deste script é de sua própria responsabilidade.

---

147enterprise © 2024. All Rights Reserved.
