import ldap from 'ldapjs';

export interface LdapUser {
  dn: string;
  sAMAccountName: string;
  displayName: string;
  mail: string;
  memberOf: string[];
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
  const searchBase  = process.env.LDAP_SEARCH_BASE || '';
  const bindDn      = process.env.LDAP_BIND_DN     || '';
  const bindPass    = process.env.LDAP_BIND_PASSWORD || '';

  return new Promise((resolve) => {
    const client = createClient();

    client.on('error', () => resolve(null));

    // 1. Bind com service account para buscar o DN do usuário
    client.bind(bindDn, bindPass, (bindErr) => {
      if (bindErr) { client.destroy(); return resolve(null); }

      client.search(searchBase, {
        filter: `(sAMAccountName=${ldap.escapeFn(username)})`,
        scope: 'sub',
        attributes: ['dn', 'sAMAccountName', 'displayName', 'mail', 'memberOf'],
      }, (searchErr, res) => {
        if (searchErr) { client.destroy(); return resolve(null); }

        let userEntry: ldap.SearchEntry | null = null;
        res.on('searchEntry', (entry) => { userEntry = entry; });
        res.on('error',       ()      => { client.destroy(); resolve(null); });
        res.on('end',         ()      => {
          if (!userEntry) { client.destroy(); return resolve(null); }

          const dn = (userEntry as ldap.SearchEntry).dn;

          // 2. Bind com as credenciais do próprio usuário para validar senha
          const userClient = createClient();
          userClient.on('error', () => resolve(null));
          userClient.bind(dn, password, (authErr) => {
            userClient.destroy();
            client.destroy();
            if (authErr) return resolve(null);

            const attrs = (userEntry as ldap.SearchEntry).pojo.attributes;
            const get   = (name: string) =>
              attrs.find((a: { type: string; values: string[] }) => a.type === name)?.values ?? [];

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

export function isInGroup(memberOf: string[], groupName: string): boolean {
  return memberOf.some((dn) =>
    dn.toLowerCase().includes(`cn=${groupName.toLowerCase()},`)
  );
}
