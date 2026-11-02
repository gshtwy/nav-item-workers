import json, subprocess, sys
BASE='http://127.0.0.1:8791'
def curl(method, path, body=None, token=None, raw=False, form=None):
    cmd=['curl','-s','--noproxy','*','-X',method,'-w','\n%{http_code}']
    if token: cmd+=['-H',f'Authorization: Bearer {token}']
    if body is not None: cmd+=['-H','content-type: application/json','-d',json.dumps(body)]
    if form: cmd+=['-F',form]
    cmd.append(BASE+path)
    out=subprocess.run(cmd, capture_output=True, text=True, env={'PATH':'/usr/bin:/bin:/usr/local/bin','HOME':'/home/hatch'}).stdout
    txt, code = out.rsplit('\n',1)
    if raw: return int(code), txt
    try: return int(code), json.loads(txt)
    except: return int(code), txt
fails=[]
def check(name, cond, extra=''):
    print(('PASS' if cond else 'FAIL'), name, extra if not cond else '')
    if not cond: fails.append(name)

c,r=curl('GET','/api/menus'); check('menus 200+6条', c==200 and len(r)==6, f'{c} {str(r)[:120]}')
check('menus带subMenus', any(m.get('subMenus') for m in r))
home=[m for m in r if m['name']=='Home'][0]
c,r=curl('GET',f"/api/cards/{home['id']}"); check('cards/1 有Baidu+display_logo', c==200 and len(r)>10 and r[0]['title']=='Baidu' and 'display_logo' in r[0], f'{c} {str(r)[:150]}')
c,r=curl('GET','/api/cards/2?subMenuId=1'); check('子菜单卡片', c==200 and len(r)>=1, f'{c} {str(r)[:120]}')
c,r=curl('GET','/api/friends'); check('friends 2条', c==200 and len(r)==2)
c,r=curl('GET','/api/ads'); check('ads 空数组', c==200 and r==[])
c,r=curl('GET','/api/menus?page=1&pageSize=2'); check('menus分页', c==200 and r.get('total')==6 and len(r.get('data',[]))==2, f'{c} {str(r)[:120]}')
c,r=curl('GET','/',raw=True); check('首页HTML', c==200 and 'Navitem' in r)
c,r=curl('GET','/admin',raw=True); check('/admin SPA回退', c==200 and 'Navitem' in r)
c,r=curl('POST','/api/login',{'username':'admin','password':'wrong'}); check('错密码401', c==401 and r.get('error')=='用户名或密码错误', f'{c} {r}')
c,r=curl('POST','/api/login',{'username':'admin','password':'test-admin-pw-2026'}); check('登录成功发token', c==200 and bool(r.get('token')), f'{c} {str(r)[:100]}')
tok=r.get('token','')
c,r=curl('POST','/api/menus',{'name':'测试栏目','order':9}); check('无token写菜单401', c==401 and r.get('error')=='未授权', f'{c} {r}')
c,r=curl('POST','/api/menus',{'name':'测试栏目','order':9},token='bad.token.here'); check('坏token401', c==401 and r.get('error')=='无效token', f'{c} {r}')
c,r=curl('POST','/api/menus',{'name':'测试栏目','order':9},token=tok); check('建菜单', c==200 and r.get('id'), f'{c} {r}'); mid=r.get('id')
c,r=curl('POST',f'/api/menus/{mid}/submenus',{'name':'子栏目A','order':1},token=tok); check('建子菜单', c==200 and r.get('id')); sid=r.get('id')
c,r=curl('PUT',f'/api/menus/submenus/{sid}',{'name':'子栏目B','order':2},token=tok); check('改子菜单', c==200 and r.get('changed')==1, f'{c} {r}')
c,r=curl('POST','/api/cards',{'menu_id':mid,'title':'示例站','url':'https://example.com','logo_url':'','desc':'测试'},token=tok); check('建卡片', c==200 and r.get('id')); cid=r.get('id')
c,r=curl('PUT',f'/api/cards/{cid}',{'menu_id':mid,'title':'示例站2','url':'https://example.com','logo_url':'','desc':'测试2','order':1},token=tok); check('改卡片', c==200 and r.get('changed')==1)
c,r=curl('GET',f'/api/cards/{mid}'); check('读新卡片', c==200 and len(r)==1 and r[0]['title']=='示例站2', f'{c} {str(r)[:150]}')
c,r=curl('POST','/api/ads',{'position':'left','img':'https://x/y.png','url':'https://example.com'},token=tok); check('建广告', c==200 and r.get('id')); aid=r.get('id')
c,r=curl('PUT',f'/api/ads/{aid}',{'img':'https://x/z.png','url':'https://example.org'},token=tok); check('改广告', c==200 and r.get('changed')==1)
c,r=curl('POST','/api/friends',{'title':'友链X','url':'https://example.net','logo':''},token=tok); check('建友链', c==200 and r.get('id')); fid=r.get('id')
c,r=curl('GET','/api/users',token=tok); check('用户列表', c==200 and len(r.get('data',[]))==1 and r['data'][0]['username']=='admin', f'{c} {str(r)[:120]}')
c,r=curl('GET','/api/users/profile',token=tok); check('profile', c==200 and r.get('data',{}).get('username')=='admin')
c,r=curl('GET','/api/users/me',token=tok); check('me有上次登录IP/时间', c==200 and 'last_login_time' in r and bool(r['last_login_time']), f'{c} {r}')
c,r=curl('PUT','/api/users/password',{'oldPassword':'不对的旧密码','newPassword':'newpass-2026'},token=tok); check('改密旧密码错400', c==400 and r.get('message')=='旧密码错误', f'{c} {r}')
c,r=curl('GET','/api/upload',raw=True); check('upload GET 404', c==404)
# 上传：无token应401，有token应成功
open('/tmp/logo-test.png','wb').write(bytes.fromhex('89504e470d0a1a0a')+b'FAKEPNGDATA')
c,r=curl('POST','/api/upload',form='logo=@/tmp/logo-test.png;type=image/png'); check('无token上传401', c==401, f'{c} {r}')
c,r=curl('POST','/api/upload',token=tok,form='logo=@/tmp/logo-test.png;type=image/png'); _nor2 = (c==501 and isinstance(r,dict) and 'R2' in str(r.get('error',''))); check('上传成功（无R2时501亦可）', (c==200 and r.get('url','').startswith('/uploads/')) or _nor2, f'{c} {r}'); up=r.get('url','') if c==200 else ''
_o=subprocess.run(['curl','-s','--noproxy','*','-o','/tmp/up-back.png','-w','%{http_code}',BASE+up],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin'}).stdout
check('上传文件可读回（无R2时跳过）', up=='' or (_o=='200' and b'FAKEPNGDATA' in open('/tmp/up-back.png','rb').read()), _o)
_o=subprocess.run(['curl','-s','--noproxy','*','-o','/dev/null','-w','%{http_code}',BASE+'/uploads/default-favicon.png'],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin'}).stdout
check('默认图标回退', _o=='200', _o)
c,r=curl('DELETE',f'/api/cards/{cid}',token=tok); check('删卡片', c==200 and r.get('deleted')==1)
c,r=curl('DELETE',f'/api/ads/{aid}',token=tok); check('删广告', c==200 and r.get('deleted')==1)
c,r=curl('DELETE',f'/api/friends/{fid}',token=tok); check('删友链', c==200 and r.get('deleted')==1)
c,r=curl('DELETE',f'/api/menus/submenus/{sid}',token=tok); check('删子菜单', c==200 and r.get('deleted')==1)
c,r=curl('DELETE',f'/api/menus/{mid}',token=tok); check('删菜单', c==200 and r.get('deleted')==1)
c,r=curl('PUT','/api/users/password',{'oldPassword':'test-admin-pw-2026','newPassword':'newpass-2026'},token=tok); check('改密成功', c==200 and r.get('message')=='密码修改成功', f'{c} {r}')
c,r=curl('POST','/api/login',{'username':'admin','password':'newpass-2026'}); check('新密码可登录', c==200 and bool(r.get('token')))
print('\n总失败:', len(fails), fails)
sys.exit(1 if fails else 0)
