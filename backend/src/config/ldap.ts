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

function baseDnToDomain(baseDn: string): string {
  return baseDn.split(',')
    .filter((p) => p.toLowerCase().startsWith('dc='))
    .map((p) => p.slice(3))
    .join('.');
}

function bindAsync(client: ldap.Client, dn: string, password: string): Promise<boolean> {
  return new Promise((resolve) => {
    client.bind(dn, password, (err) => resolve(!err));
  });
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<LdapUser | null> {
  const searchBase = process.env.LDAP_SEARCH_BASE || '';
  const bindDn     = process.env.LDAP_BIND_DN      || '';
  const bindPass   = process.env.LDAP_BIND_PASSWORD || '';
  const domain     = baseDnToDomain(process.env.LDAP_BASE_DN || '');

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
        res.on('end', async () => {
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

          client.destroy();

          // Tenta bind com DN completo primeiro, depois com UPN (user@domain)
          const upn = `${username}@${domain}`;
          console.log('[LDAP] Tentando bind — DN:', dn, '| UPN:', upn);

          const c1 = createClient();
          c1.on('error', () => {});
          const okDn = await bindAsync(c1, dn, password);
          c1.destroy();

          if (!okDn) {
            console.log('[LDAP] Bind por DN falhou, tentando UPN...');
            const c2 = createClient();
            c2.on('error', () => {});
            const okUpn = await bindAsync(c2, upn, password);
            c2.destroy();

            if (!okUpn) {
              console.error('[LDAP] Autenticação falhou para:', username, '(DN e UPN recusados)');
              return resolve(null);
            }
            console.log('[LDAP] Autenticado via UPN:', upn);
          } else {
            console.log('[LDAP] Autenticado via DN:', dn);
          }

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
}

// Aceita tanto CN curto ("BF-VC-ADMIN") quanto DN completo ("CN=BF-VC-ADMIN,OU=GRUPOS,DC=...")
export function isInGroup(memberOf: string[], groupName: string): boolean {
  const lower = groupName.toLowerCase().trim();
  return memberOf.some((dn) => {
    const dnLower = dn.toLowerCase().trim();
    if (dnLower === lower) return true;
    return dnLower.includes(`cn=${lower},`);
  });
}
