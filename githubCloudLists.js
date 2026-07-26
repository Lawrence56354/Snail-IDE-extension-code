(function(Scratch) {
  'use strict';

  // Ensure the extension runs unsandboxed to allow GitHub API requests
  if (!Scratch.extensions.unsandboxed) {
    throw new Error('This GitHub Cloud List extension must be run unsandboxed!');
  }

  class GitHubCloudLists {
    constructor() {
      this.cachedList = [];
    }

    getInfo() {
      return {
        id: 'githubCloudLists',
        name: 'GitHub Cloud Lists',
        color1: '#24292e', // GitHub Dark Theme Grey
        color2: '#1f2328',
        blocks: [
          {
            opcode: 'setCredentials',
            blockType: Scratch.BlockType.COMMAND,
            text: 'set GitHub repo [REPO] token [TOKEN] file path [PATH]',
            arguments: {
              REPO: { type: Scratch.ArgumentType.STRING, defaultValue: 'username/repo-name' },
              TOKEN: { type: Scratch.ArgumentType.STRING, defaultValue: 'ghp_yourTokenHere' },
              PATH: { type: Scratch.ArgumentType.STRING, defaultValue: 'cloud_list.json' }
            }
          },
          {
            opcode: 'fetchCloudList',
            blockType: Scratch.BlockType.COMMAND,
            text: 'fetch cloud list from GitHub'
          },
          {
            opcode: 'pushCloudList',
            blockType: Scratch.BlockType.COMMAND,
            text: 'push list [LIST] to GitHub cloud',
            arguments: {
              LIST: { type: Scratch.ArgumentType.STRING, defaultValue: 'my-list' }
            }
          },
          {
            opcode: 'getCloudItem',
            blockType: Scratch.BlockType.REPORTER,
            text: 'item [INDEX] of GitHub cloud list',
            arguments: {
              INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'getCloudListLength',
            blockType: Scratch.BlockType.REPORTER,
            text: 'length of GitHub cloud list'
          }
        ]
      };
    }

    setCredentials(args) {
      this.repo = args.REPO;
      this.token = args.TOKEN;
      this.path = args.PATH;
    }

    async fetchCloudList() {
      if (!this.repo || !this.token || !this.path) return 'Missing configuration';
      const url = `https://github.com{this.repo}/contents/${this.path}`;
      
      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `token ${this.token}` }
        });
        
        if (response.status === 404) {
          this.cachedList = []; // File doesn't exist yet
          return;
        }

        const data = await response.json();
        this.fileSha = data.sha; // Save SHA needed for subsequent updates
        const content = atob(data.content); // Decode Base64 from GitHub
        this.cachedList = JSON.parse(content);
      } catch (err) {
        console.error('Failed to fetch cloud list:', err);
      }
    }

    async pushCloudList(args, util) {
      if (!this.repo || !this.token || !this.path) return;

      // Extract raw array items from Snail IDE's internal list storage
      const targetListName = args.LIST;
      const stage = util.target.runtime.getTargetForStage();
      const scratchList = stage.lookupListByName(targetListName);
      if (!scratchList) return;

      const listArray = scratchList.value; 
      const contentBase64 = btoa(JSON.stringify(listArray));
      const url = `https://github.com{this.repo}/contents/${this.path}`;

      // Always fetch latest SHA right before pushing to prevent overwrite conflicts
      await this.fetchCloudList();

      const body = {
        message: 'Update cloud list via Snail IDE Extension',
        content: contentBase64,
        sha: this.fileSha || undefined
      };

      try {
        await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      } catch (err) {
        console.error('Failed to push cloud list:', err);
      }
    }

    getCloudItem(args) {
      const index = Math.floor(args.INDEX) - 1; // Convert 1-indexed Scratch to 0-indexed JS
      if (index >= 0 && index < this.cachedList.length) {
        return this.cachedList[index];
      }
      return '';
    }

    getCloudListLength() {
      return this.cachedList.length;
    }
  }

  Scratch.extensions.register(new GitHubCloudLists());
})(Scratch);
