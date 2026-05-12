import ldap from 'ldapjs';

export interface LdapUser {
  dn: string;
  sAMAccountName: string;
  displayName: string;
  mail: string;
  memberOf: string[];
}

function escapeFilter(value: string): string {
  return value.replace(/[\\*()\x00]/g, (c) =>
    `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`
  );
}

function createClient(): ldap.Client {
  return ldap.createClient({
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    timeout: 5000,
    connectTimeout: 5000,
  });
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<LdapUser | null> {
  const searchBase = process.env.LDAP_SEARCH_BASE || '';
  const bindDn     = process.env.LDAP_BIND_DN      || '';
  const bindPass   = process.env.LDAP_BIND_PASSWORD || '';

  return new Promise((resolve) => {
    const client = createClient();
    client.on('error', (err) => {
      console.error('[LDAP] Erro de conexão:', err.message);
      resolve(null);
    });

    client.bind(bindDn, bindPass, (bindErr) => {
      if (bindErr) {
        console.error('[LDAP] Erro no bind do service account:', bindErr.message);
        client.destroy();
        return resolve(null);
      }

      client.search(searchBase, {
        filter: `(sAMAccountName=${escapeFilter(username)})`,
        scope: 'sub',
        attributes: ['dn', 'sAMAccountName', 'displayName', 'mail', 'memberOf'],
      }, (searchErr, res) => {
        if (searchErr) {
          console.error('[LDAP] Erro na busca:', searchErr.message);
          client.destroy();
          return resolve(null);
        }

        let userEntry: ldap.SearchEntry | null = null;
        res.on('searchEntry', (entry) => { userEntry = entry; });
        res.on('error', (err) => {
          console.error('[LDAP] Erro no resultado da busca:', err.message);
          client.destroy();
          resolve(null);
        });
        res.on('end', () => {
          if (!userEntry) {
            console.error('[LDAP] Usuário não encontrado:', username);
            client.destroy();
            return resolve(null);
          }

          const dn  = userEntry.dn;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obj = (userEntry as any).object as Record<string, string | string[]>;
          const get = (k: string): string[] => {
            const v = obj[k];
            if (!v) return [];
            return Array.isArray(v) ? v : [v];
          };

          const userClient = createClient();
          userClient.on('error', (err) => {
            console.error('[LDAP] Erro de conexão (user bind):', err.message);
            resolve(null);
          });
          userClient.bind(dn, password, (authErr) => {
            userClient.destroy();
            client.destroy();
            if (authErr) {
              console.error('[LDAP] Senha inválida para:', username);
              return resolve(null);
            }
            console.log('[LDAP] Autenticado com sucesso:', username, '| memberOf:', get('memberOf'));
            resolve({
              dn,
              sAMAccountName: get('sAMAccountName')[0] || username,
              displayName:    get('displayName')[0]    || username,
              mail:           get('mail')[0]           || '',
              memberOf:       get('memberOf'),
            });
          });
        });
      });
    });
  });
}

// Aceita tanto CN curto ("BF-VC-ADMIN") quanto DN completo ("CN=BF-VC-ADMIN,OU=GRUPOS,DC=...")
export function isInGroup(memberOf: string[], groupName: string): boolean {
  const lower = groupName.toLowerCase().trim();
  return memberOf.some((dn) => {
    const dnLower = dn.toLowerCase().trim();
    if (dnLower === lower) return true;               // DN completo exato
    return dnLower.includes(`cn=${lower},`);          // Nome curto
  });
}
