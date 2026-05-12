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

        // Captura os dados no evento searchEntry — antes de qualquer async
        let userDn       = '';
        let userSAM      = '';
        let userDisplay  = '';
        let userMail     = '';
        let userMemberOf: string[] = [];

        res.on('searchEntry', (entry) => {
          userDn = entry.dn.toString();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const attr of (entry as any).attributes ?? []) {
            const vals: string[] = Array.isArray(attr.values) ? attr.values : (attr.vals ?? []);
            switch (attr.type) {
              case 'sAMAccountName': userSAM      = vals[0] ?? ''; break;
              case 'displayName':    userDisplay  = vals[0] ?? ''; break;
              case 'mail':           userMail     = vals[0] ?? ''; break;
              case 'memberOf':       userMemberOf = vals;           break;
            }
          }
        });

        res.on('error', (err) => {
          console.error('[LDAP] Erro no resultado da busca:', err.message);
          client.destroy();
          resolve(null);
        });

        res.on('end', async () => {
          client.destroy();

          if (!userDn) {
            console.error('[LDAP] Usuário não encontrado:', username);
            return resolve(null);
          }

          const upn = `${username}@${domain}`;
          console.log('[LDAP] Usuário encontrado — DN:', userDn, '| memberOf:', userMemberOf);
          console.log('[LDAP] Tentando bind via DN...');

          const c1 = createClient();
          c1.on('error', () => {});
          const okDn = await bindAsync(c1, userDn, password);
          c1.destroy();

          if (!okDn) {
            console.log('[LDAP] Bind por DN falhou, tentando UPN:', upn);
            const c2 = createClient();
            c2.on('error', () => {});
            const okUpn = await bindAsync(c2, upn, password);
            c2.destroy();

            if (!okUpn) {
              console.error('[LDAP] Autenticação falhou (DN e UPN recusados) para:', username);
              return resolve(null);
            }
            console.log('[LDAP] Autenticado via UPN:', upn);
          } else {
            console.log('[LDAP] Autenticado via DN');
          }

          resolve({
            dn:             userDn,
            sAMAccountName: userSAM     || username,
            displayName:    userDisplay || username,
            mail:           userMail,
            memberOf:       userMemberOf,
          });
        });
      });
    });
  });
}

// Aceita CN curto ("BF-VC-ADMIN") ou DN completo ("CN=BF-VC-ADMIN,OU=GRUPOS,DC=...")
export function isInGroup(memberOf: string[], groupName: string): boolean {
  const lower = groupName.toLowerCase().trim();
  return memberOf.some((dn) => {
    const dnLower = dn.toLowerCase().trim();
    if (dnLower === lower) return true;
    return dnLower.includes(`cn=${lower},`);
  });
}
