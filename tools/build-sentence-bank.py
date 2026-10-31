"""Build original sentence variants from reviewed, semantically constrained patterns.
No paid API or DuShu sentence-library extraction is used. Retains the original 40 IDs.
Run from any directory: python tools/build-sentence-bank.py
"""
from pathlib import Path
from itertools import product
import json, re, hashlib
ROOT=Path(__file__).resolve().parents[1]
class P:
 def __init__(self,zh,py,en):
  self.zh,self.py,self.en=zh,py,en
  assert len(re.findall(r'[\u3400-\u9fff]',zh))==len(py.split()),(zh,py)
def p(zh,py,en=''):return P(zh,py,en)
def bank(raw):return [P(*line.split('|')) for line in raw.strip().splitlines()]
def mid(x):return x.en[:1].lower()+x.en[1:]
def build(parts,en):
 zh=''.join(x.zh for x in parts);py=' '.join(x.py for x in parts if x.py);syl=py.split();chars=re.findall(r'[\u3400-\u9fff]',zh)
 assert len(chars)==len(syl),(zh,py)
 tone=lambda s:4 if re.search('[àèìòùǜ]',s) else 1 if re.search('[āēīōūǖ]',s) else 2 if re.search('[áéíóúǘ]',s) else 3 if re.search('[ǎěǐǒǔǚ]',s) else 5
 for i,c in enumerate(chars[:-1]):
  if c=='不' and tone(syl[i+1])==4:syl[i]='bú'
  if c=='一' and (i==0 or chars[i-1]!='第') and ''.join(chars[max(0,i-2):i])!='星期' and chars[i+1] not in '二三四五六七八九十百千万年月日号点':syl[i]='yí' if tone(syl[i+1])==4 or chars[i+1]=='个' else 'yì'
 return zh,' '.join(syl),en
DAYS=bank('''今天|jīn tiān|today
明天|míng tiān|tomorrow
星期一|xīng qī yī|on Monday
星期三|xīng qī sān|on Wednesday
星期五|xīng qī wǔ|on Friday
星期天|xīng qī tiān|on Sunday''')
TIMES=bank('''今天早上|jīn tiān zǎo shang|this morning
今天下午|jīn tiān xià wǔ|this afternoon
今天晚上|jīn tiān wǎn shang|this evening
明天早上|míng tiān zǎo shang|tomorrow morning
明天下午|míng tiān xià wǔ|tomorrow afternoon
明天晚上|míng tiān wǎn shang|tomorrow evening''')
PAST=bank('''昨天|zuó tiān|yesterday
昨天早上|zuó tiān zǎo shang|yesterday morning
昨天下午|zuó tiān xià wǔ|yesterday afternoon
昨天晚上|zuó tiān wǎn shang|last night
今天早上|jīn tiān zǎo shang|this morning''')
PLACES=bank('''学校|xué xiào|school
医院|yī yuàn|the hospital
商店|shāng diàn|the shop
饭馆|fàn guǎn|the restaurant
火车站|huǒ chē zhàn|the railway station
机场|jī chǎng|the airport
公司|gōng sī|the office
朋友家|péng you jiā|my friend's home''')
FOOD=bank('''米饭|mǐ fàn|rice
面条|miàn tiáo|noodles
鸡蛋|jī dàn|eggs
苹果|píng guǒ|apples
西瓜|xī guā|watermelon
鱼|yú|fish
羊肉|yáng ròu|lamb
菜|cài|vegetables''')
DRINK=bank('''茶|chá|tea
咖啡|kā fēi|coffee
牛奶|niú nǎi|milk
水|shuǐ|water''')
ACT=bank('''看书|kàn shū|read
看电影|kàn diàn yǐng|watch a film
做饭|zuò fàn|cook
听音乐|tīng yīn yuè|listen to music
学习汉语|xué xí hàn yǔ|study Chinese
游泳|yóu yǒng|swim
跑步|pǎo bù|go for a run
打篮球|dǎ lán qiú|play basketball''')
GERUND={'看书':'reading','看电影':'watching a film','做饭':'cooking','听音乐':'listening to music','学习汉语':'studying Chinese','游泳':'swimming','跑步':'running','打篮球':'playing basketball'}
P2=bank('''妈妈|mā ma|My mum
爸爸|bà ba|My dad
姐姐|jiě jie|My older sister
哥哥|gē ge|My older brother
弟弟|dì di|My younger brother
妹妹|mèi mei|My younger sister
我的朋友|wǒ de péng you|My friend
我们的老师|wǒ men de lǎo shī|Our teacher''')
PEOPLE=bank('''我的朋友|wǒ de péng you|My friend
我的同学|wǒ de tóng xué|My classmate
我的同事|wǒ de tóng shì|My colleague
我们的老师|wǒ men de lǎo shī|Our teacher
我姐姐|wǒ jiě jie|My older sister
我弟弟|wǒ dì di|My younger brother''')
GIFTS=bank('''一本书|yī běn shū|a book
一件衣服|yī jiàn yī fu|an item of clothing
一个苹果|yī ge píng guǒ|an apple
一个杯子|yī ge bēi zi|a cup
一块手表|yī kuài shǒu biǎo|a watch
一支铅笔|yī zhī qiān bǐ|a pencil''')
OBJECTS=bank('''这本书|zhè běn shū|this book
这个杯子|zhè ge bēi zi|this cup
这支笔|zhè zhī bǐ|this pen
这张票|zhè zhāng piào|this ticket
我的手机|wǒ de shǒu jī|my phone
我的手表|wǒ de shǒu biǎo|my watch''')
SLOTS=bank('''桌子上|zhuō zi shang|on the table
椅子上|yǐ zi shang|on the chair
书包里|shū bāo lǐ|in the schoolbag
房间里|fáng jiān lǐ|in the room''')
READY=bank('''今天有时间|jīn tiān yǒu shí jiān|I have time today
下午不用上班|xià wǔ bú yòng shàng bān|I don't have to work this afternoon
明天没有考试|míng tiān méi yǒu kǎo shì|I don't have an exam tomorrow
这几天不太忙|zhè jǐ tiān bú tài máng|I'm not too busy these days
工作已经做完了|gōng zuò yǐ jīng zuò wán le|I've finished my work''')
BUSY=bank('''今天很忙|jīn tiān hěn máng|today is very busy
时间不太多|shí jiān bú tài duō|I don't have much time
有一点累|yǒu yī diǎn lèi|I'm a little tired
还有很多工作|hái yǒu hěn duō gōng zuò|I still have a lot of work
明天要早起|míng tiān yào zǎo qǐ|I have to get up early tomorrow''')
INTEREST=bank('''中国历史|zhōng guó lì shǐ|Chinese history
中文电影|zhōng wén diàn yǐng|Chinese films
中国音乐|zhōng guó yīn yuè|Chinese music
汉语语法|hàn yǔ yǔ fǎ|Chinese grammar
中国文化|zhōng guó wén huà|Chinese culture
中国菜|zhōng guó cài|Chinese cooking
旅游|lǚ yóu|travel
运动|yùn dòng|sport''')
SKILL=bank('''做饭|zuò fàn|cooking
说中文|shuō zhōng wén|speaking Chinese
用电脑|yòng diàn nǎo|using a computer
坐地铁|zuò dì tiě|taking the metro
骑自行车|qí zì xíng chē|riding a bicycle
写汉字|xiě hàn zì|writing Chinese characters
游泳|yóu yǒng|swimming
点菜|diǎn cài|ordering food''')
DURATION=bank('''十分钟|shí fēn zhōng|ten minutes
二十分钟|èr shí fēn zhōng|twenty minutes
半个小时|bàn ge xiǎo shí|half an hour
一个小时|yī ge xiǎo shí|an hour''')
EVENT=bank('''比赛|bǐ sài|competition
旅游|lǚ yóu|trip
会议|huì yì|meeting
聚会|jù huì|get-together
活动|huó dòng|event
中文课|zhōng wén kè|Chinese class''')
GROUP=bank('''很多新朋友|hěn duō xīn péng you|many new friends
几个中国朋友|jǐ ge zhōng guó péng you|several Chinese friends
几个新同学|jǐ ge xīn tóng xué|several new classmates
一些有意思的人|yī xiē yǒu yì si de rén|some interesting people
几个喜欢音乐的人|jǐ ge xǐ huan yīn yuè de rén|some people who like music''')
OBS=bank('''手机没电了|shǒu jī méi diàn le|my phone had run out of battery
已经很晚了|yǐ jīng hěn wǎn le|it was already very late
忘了带水|wàng le dài shuǐ|I'd forgotten to bring water
还有一件事没做|hái yǒu yī jiàn shì méi zuò|I still had one thing left to do
天已经黑了|tiān yǐ jīng hēi le|it had already got dark''')
REST=bank('''喝一杯茶|hē yī bēi chá|have a cup of tea
休息一下|xiū xi yī xià|rest a little
吃点东西|chī diǎn dōng xi|eat something
坐一会儿|zuò yī huì er|sit down for a while''')
FINISH=bank('''做完作业|zuò wán zuò yè|finished their homework
做完工作|zuò wán gōng zuò|finished their work
准备好|zhǔn bèi hǎo|got ready
找到钥匙|zhǎo dào yào shi|found their keys
收拾好东西|shōu shi hǎo dōng xi|finished packing''')
NOUNS=bank('''手机|shǒu jī|phone
手表|shǒu biǎo|watch
衣服|yī fu|item of clothing
书包|shū bāo|schoolbag
自行车|zì xíng chē|bicycle
电脑|diàn nǎo|computer''')
ADJ=bank('''新|xīn|new
旧|jiù|old
漂亮|piào liang|attractive
好看|hǎo kàn|nice-looking
好|hǎo|good''')
STUDY_GOALS=[(p('学好汉语','xué hǎo hàn yǔ','learn Chinese well'),p('练习说中文','liàn xí shuō zhōng wén','practise speaking Chinese')),(p('看懂中文书','kàn dǒng zhōng wén shū','understand Chinese books'),p('学习新的汉字','xué xí xīn de hàn zì','learn new Chinese characters')),(p('提高听力','tí gāo tīng lì','improve listening skills'),p('听中文新闻','tīng zhōng wén xīn wén','listen to Chinese news')),(p('写好汉字','xiě hǎo hàn zì','write Chinese characters well'),p('练习写字','liàn xí xiě zì','practise writing')),(p('让身体更健康','ràng shēn tǐ gèng jiàn kāng','be healthier'),p('去公园跑步','qù gōng yuán pǎo bù','go running in the park')),(p('准备考试','zhǔn bèi kǎo shì','prepare for an exam'),p('复习课本','fù xí kè běn','review the textbook')),(p('做出好吃的菜','zuò chū hǎo chī de cài','make tasty dishes'),p('跟妈妈学做饭','gēn mā ma xué zuò fàn','learn cooking from Mum')),(p('打好篮球','dǎ hǎo lán qiú','play basketball well'),p('跟朋友练习打球','gēn péng you liàn xí dǎ qiú','practise playing with friends'))]
VISITS=[(p('学校','xué xiào','school'),p('去图书馆看书','qù tú shū guǎn kàn shū','read in the library')),(p('饭馆','fàn guǎn','the restaurant'),p('点一碗面条','diǎn yī wǎn miàn tiáo','order a bowl of noodles')),(p('公园','gōng yuán','the park'),p('在湖边散步','zài hú biān sàn bù','walk by the lake')),(p('商店','shāng diàn','the shop'),p('看看有什么新东西','kàn kan yǒu shén me xīn dōng xi','look for new things')),(p('朋友家','péng you jiā',"a friend's home"),p('和朋友聊天','hé péng you liáo tiān','chat with friends')),(p('医院','yī yuàn','the hospital'),p('先去挂号','xiān qù guà hào','register first')),(p('机场','jī chǎng','the airport'),p('先看航班信息','xiān kàn háng bān xìn xī','check the flight information first')),(p('超市','chāo shì','the supermarket'),p('买一些水果','mǎi yī xiē shuǐ guǒ','buy some fruit'))]
# Vocabulary in the last two visit patterns extends beyond HSK 3; these are excluded.
VISITS=VISITS[:5]+VISITS[7:]
EAT_PLACES=bank('''这家饭馆|zhè jiā fàn guǎn|this restaurant
学校食堂|xué xiào shí táng|the school canteen
公司附近的饭馆|gōng sī fù jìn de fàn guǎn|the restaurant near the office
朋友家|péng you jiā|my friend's home''')
MEALS=bank('''吃早饭的时候|chī zǎo fàn de shí hou|at breakfast
吃午饭的时候|chī wǔ fàn de shí hou|at lunch
吃晚饭的时候|chī wǎn fàn de shí hou|at dinner
和朋友吃饭的时候|hé péng you chī fàn de shí hou|when eating with friends''')
FOOD_PAIRS=[(FOOD[0],FOOD[2]),(FOOD[0],FOOD[5]),(FOOD[1],FOOD[2]),(FOOD[0],FOOD[7]),(FOOD[1],FOOD[5]),(FOOD[0],FOOD[6]),(FOOD[1],FOOD[7]),(FOOD[5],FOOD[7])]
rows=[];seen=set();stats=[]
# Original IDs stay stable so saved sentences and reading progress continue to work.
original=(ROOT/'assets/sentences.js').read_text();seed=json.loads(original[original.index('['):original.rindex(']')+1])
for r in seed:seen.add(r['zh'])
def family(level,name,iterable,fn,n):
 candidates=[]
 for args in iterable:
  result=fn(*args) if isinstance(args,tuple) else fn(args)
  zh,py,en=result
  if zh in seen:continue
  candidates.append((zh,py,en))
 # Spread examples across every slot instead of taking all variants of the first slot.
 candidates=sorted(candidates,key=lambda r:hashlib.sha256((name+r[0]).encode()).hexdigest())
 selected=candidates[:n];assert len(selected)==n,(name,len(selected),n)
 for zh,py,en in selected:
  assert zh not in seen;seen.add(zh)
  rows.append(dict(id='pattern-'+hashlib.sha256(zh.encode()).hexdigest()[:14],level=level,zh=zh,py=py,en=en,topic=name))
 stats.append((level,name,n,selected[0]))
F=lambda name,it,fn:family(2,name,it,fn,16)
F('Meals',product(TIMES,FOOD),lambda t,f:build([t,p('我想吃','wǒ xiǎng chī'),f,p('。','')],f'I would like to eat {f.en} {t.en}.'))
F('A drink',product(TIMES,DRINK),lambda t,d:build([t,p('我想喝','wǒ xiǎng hē'),d,p('，你呢？','nǐ ne')],f'I would like to drink {d.en} {t.en}. What about you?'))
F('Going places',product(DAYS,PLACES),lambda d,l:build([d,p('我们去','wǒ men qù'),l,p('。','')],f'We are going to {l.en} {d.en}.'))
F('Where I am',product(TIMES[:3],PLACES),lambda t,l:build([p('我','wǒ'),t,p('在','zài'),l,p('。','')],f'I am at {l.en} {t.en}.'))
F('Plans',product(TIMES,ACT),lambda t,a:build([t,p('我想','wǒ xiǎng'),a,p('。','')],f'I would like to {a.en} {t.en}.'))
F('Do you have time',product(DAYS,ACT),lambda d,a:build([p('你','nǐ'),d,p('有时间','yǒu shí jiān'),a,p('吗？','ma')],f'Do you have time to {a.en} {d.en}?'))
F('Already there',product(PAST,PLACES),lambda t,l:build([p('我','wǒ'),t,p('已经到','yǐ jīng dào'),l,p('了。','le')],f'I had already arrived at {l.en} {t.en}.'))
F('Nearby',[(a,b) for a,b in product(PLACES,PLACES) if a.zh!=b.zh],lambda a,b:build([a,p('离','lí'),b,p('很近。','hěn jìn')],f'{a.en[0].upper()+a.en[1:]} is very close to {b.en}.'))
F('Comparing prices',[(a,b) for a,b in product(FOOD,FOOD) if a.zh!=b.zh],lambda a,b:build([a,p('比','bǐ'),b,p('贵。','guì')],f'The price of {a.en} is higher than the price of {b.en}.'))
F('Too hot',product(TIMES[:3]+[p('昨天晚上','zuó tiān wǎn shang','last night')],DRINK),lambda t,d:build([t,p('的','de'),d,p('太热了。','tài rè le')],f'The {d.en} was too hot {t.en}.'))
F('Buying gifts',product(P2,GIFTS),lambda person,g:build([p('我想给','wǒ xiǎng gěi'),person,p('买','mǎi'),g,p('。','')],f'I want to buy {mid(person)} {g.en}.'))
F('What people are doing',product(P2,ACT),lambda person,a:build([person,p('正在','zhèng zài'),a,p('。','')],f'{person.en} is {GERUND[a.zh]}.'))
F('Where I need to go',product(TIMES,PLACES),lambda t,l:build([p('我','wǒ'),t,p('要去','yào qù'),l,p('。','')],f'I need to go to {l.en} {t.en}.'))
F('Doing things together',product(DAYS,ACT),lambda d,a:build([p('我们','wǒ men'),d,p('一起','yī qǐ'),a,p('吧。','ba')],f"Let's {a.en} together {d.en}."))
F('Come here',product(P2,PLACES),lambda person,l:build([p('我请','wǒ qǐng'),person,p('来','lái'),l,p('。','')],f'I am asking {mid(person)} to come to {l.en}.'))
F('What I ate',product(PAST,FOOD),lambda t,f:build([t,p('我吃了','wǒ chī le'),f,p('。','')],f'I ate {f.en} {t.en}.'))
F('Food shopping',product(TIMES,FOOD),lambda t,f:build([p('我','wǒ'),t,p('要买','yào mǎi'),f,p('。','')],f'I need to buy {f.en} {t.en}.'))
F('Invitations',product(DAYS,PLACES),lambda d,l:build([d,p('你想去','nǐ xiǎng qù'),l,p('吗？','ma')],f'Would you like to go to {l.en} {d.en}?'))
F('Waiting for someone',product(PLACES,P2),lambda l,person:build([p('我在','wǒ zài'),l,p('等','děng'),person,p('。','')],f'I am waiting for {mid(person)} at {l.en}.'))
F('Shared interests',product(P2,ACT),lambda person,a:build([person,p('喜欢','xǐ huan'),a,p('，我也喜欢。','wǒ yě xǐ huan')],f'{person.en} likes {GERUND[a.zh]}, and so do I.'))
G=lambda name,it,fn:family(3,name,it,fn,30)
G('Because and so',product(READY,ACT),lambda r,a:build([p('因为','yīn wèi'),r,p('，所以我决定','suǒ yǐ wǒ jué dìng'),a,p('。','')],f'Because {r.en}, I have decided to {a.en}.'))
G('Although and but',product(BUSY,ACT),lambda r,a:build([p('虽然','suī rán'),r,p('，但是我还是想','dàn shì wǒ hái shì xiǎng'),a,p('。','')],f'Although {r.en}, I still want to {a.en}.'))
G('If and then',product(READY,PLACES),lambda r,l:build([p('如果','rú guǒ'),r,p('，我就去','wǒ jiù qù'),l,p('。','')],f'If {r.en}, I will go to {l.en}.'))
G('Working towards a goal',product(PEOPLE,STUDY_GOALS),lambda person,pair:build([p('为了','wèi le'),pair[0],p('，',''),person,p('每天都','měi tiān dōu'),pair[1],p('。','')],f'To {pair[0].en}, {mid(person)} makes time every day to {pair[1].en}.'))
G('First and then',[(a,b) for a,b in product(ACT,ACT) if a.zh!=b.zh],lambda a,b:build([p('我先','wǒ xiān'),a,p('，然后再','rán hòu zài'),b,p('。','')],f'I will {a.en} first, and then {b.en}.'))
G('Every visit',product(PEOPLE,VISITS),lambda person,pair:build([p('每次','měi cì'),person,p('去','qù'),pair[0],p('，都会','dōu huì'),pair[1],p('。','')],f'Whenever {mid(person)} goes to {pair[0].en}, they {pair[1].en}.'))
QUIET_ACT=[ACT[i] for i in [0,2,4]]+[p('打扫房间','dǎ sǎo fáng jiān','clean the room'),p('洗衣服','xǐ yī fu','wash clothes'),p('画画','huà huà','draw')]
G('While doing something',product(TIMES,QUIET_ACT),lambda t,a:build([p('我','wǒ'),t,a,p('的时候，想听音乐。','de shí hou xiǎng tīng yīn yuè')],f'I would like to listen to music while I {a.en} {t.en}.'))
G('Being interested',product(PEOPLE,INTEREST),lambda person,x:build([person,p('对','duì'),x,p('很感兴趣。','hěn gǎn xìng qù')],f'{person.en} is very interested in {x.en}.'))
G('Easier than before',product(PEOPLE,SKILL),lambda person,x:build([person,p('觉得','jué de'),x,p('比以前容易多了。','bǐ yǐ qián róng yì duō le')],f'{person.en} finds {x.en} much easier than before.'))
# Skill phrases describe activities; "学会" accepts those same Chinese verb phrases.
SKILL_BASE={'做饭':'cook','说中文':'speak Chinese','用电脑':'use a computer','坐地铁':'take the metro','骑自行车':'ride a bicycle','写汉字':'write Chinese characters','游泳':'swim','点菜':'order food'}
G('Learning and teaching',product(SKILL,PEOPLE),lambda x,person:build([p('我已经学会','wǒ yǐ jīng xué huì'),x,p('了，下次可以教','le xià cì kě yǐ jiāo'),person,p('。','')],f"I've learned how to {SKILL_BASE[x.zh]}. Next time, I can teach {mid(person)}."))
G('Making travel plans',product(DAYS,PLACES),lambda d,l:build([p('我打算','wǒ dǎ suàn'),d,p('去','qù'),l,p('，你要一起去吗？','nǐ yào yī qǐ qù ma')],f'I plan to go to {l.en} {d.en}. Would you like to come along?'))
G('Better than expected',product(EAT_PLACES,FOOD),lambda l,f:build([l,p('的','de'),f,p('比我想的好吃。','bǐ wǒ xiǎng de hǎo chī')],f"The {f.en} at {l.en} {'taste' if f.zh in ['面条','鸡蛋','苹果','菜'] else 'tastes'} better than I expected."))
G('Putting things down',product(PEOPLE,OBJECTS),lambda person,o:build([person,p('刚才把','gāng cái bǎ'),o,p('放在桌子上了。','fàng zài zhuō zi shang le')],f'{person.en} put {o.en} on the table just now.'))
G('Where things were put',product(OBJECTS,PEOPLE,SLOTS),lambda o,person,l:build([o,p('被','bèi'),person,p('放在','fàng zài'),l,p('了。','le')],f'{person.en} put {o.en} {l.en}.'))
G('After an event',product(PAST,EVENT),lambda t,x:build([t,p('的','de'),x,p('已经结束了，大家都很高兴。','yǐ jīng jié shù le dà jiā dōu hěn gāo xìng')],f'The {x.en} {t.en} has finished, and everyone is happy.'))
G('Getting from place to place',[(a,b) for a,b in product(PLACES,PLACES) if a.zh!=b.zh],lambda a,b:build([p('从','cóng'),a,p('到','dào'),b,p('，坐公共汽车比较方便。','zuò gōng gòng qì chē bǐ jiào fāng biàn')],f'Taking the bus from {a.en} to {b.en} is quite convenient.'))
G('More and more',product(PEOPLE,ACT),lambda person,a:build([person,p('最近越来越喜欢','zuì jìn yuè lái yuè xǐ huan'),a,p('了。','le')],f'{person.en} has been enjoying {GERUND[a.zh]} more and more recently.'))
G('Making practice time',product(PEOPLE,DURATION,[x for x in SKILL if x.zh!='坐地铁']),lambda person,t,a:build([person,p('每天花','měi tiān huā'),t,p('练习','liàn xí'),a,p('。','')],f'{person.en} spends {t.en} practising {a.en} every day.'))
G('Meeting new people',product(EVENT,GROUP),lambda x,g:build([p('这次','zhè cì'),x,p('让我认识了','ràng wǒ rèn shi le'),g,p('。','')],f'I met {g.en} during this {x.en}.'))
G('One more question',product(INTEREST,PEOPLE),lambda x,person:build([p('关于','guān yú'),x,p('，',''),person,p('还有一个问题。','hái yǒu yī ge wèn tí')],f'{person.en} has another question about {x.en}.'))
G('Bring and show',product(OBJECTS,PEOPLE),lambda o,person:build([p('我把','wǒ bǎ'),o,p('带来了，想请','dài lái le xiǎng qǐng'),person,p('看一下。','kàn yī xià')],f'I brought {o.en} and would like {mid(person)} to take a look.'))
G('Besides',[(a,person,b) for a,person,b in product(ACT,PEOPLE,ACT) if a.zh!=b.zh],lambda a,person,b:build([p('除了','chú le'),a,p('，',''),person,p('还喜欢','hái xǐ huan'),b,p('。','')],f'Besides {GERUND[a.zh]}, {mid(person)} also likes {GERUND[b.zh]}.'))
G('What I noticed afterwards',product(ACT,OBS),lambda a,o:build([p('我','wǒ'),a,p('以后，才发现','yǐ hòu cái fā xiàn'),o,p('。','')],f'Only after {GERUND[a.zh]} did I notice that {o.en}.'))
G('A new restaurant',product(PEOPLE,PLACES),lambda person,l:build([person,p('告诉我，','gào su wǒ'),l,p('附近有一家新饭馆。','fù jìn yǒu yī jiā xīn fàn guǎn')],f'{person.en} told me there is a new restaurant near {l.en}.'))
G('Taking advice',product(PEOPLE,DAYS,ACT),lambda person,d,a:build([person,p('建议我','jiàn yì wǒ'),d,a,p('。','')],f'{person.en} suggests that I {a.en} {d.en}.'))
G('Asking someone for help',product(SKILL,PEOPLE),lambda a,person:build([p('如果你想','rú guǒ nǐ xiǎng'),a,p('，可以先问问','kě yǐ xiān wèn wen'),person,p('。','')],f'If you need help with {a.en}, you can ask {mid(person)} first.'))
QUIET_GERUND={**GERUND,'打扫房间':'cleaning the room','洗衣服':'washing clothes','画画':'drawing'}
G('Time for a break',product(PEOPLE,QUIET_ACT),lambda person,a:build([person,p('已经','yǐ jīng'),a,p('一个小时了，应该休息一下。','yī ge xiǎo shí le yīng gāi xiū xi yī xià')],f'{person.en} has been {QUIET_GERUND[a.zh]} for an hour and should take a break.'))
G('Not ready yet',product(PEOPLE,FINISH),lambda person,a:build([person,p('还没','hái méi'),a,p('，所以现在不能出去玩。','suǒ yǐ xiàn zài bù néng chū qù wán')],f"{person.en} hasn't {a.en} yet, so they can't go out for fun now."))
G('Eating things together',product(MEALS,FOOD_PAIRS),lambda t,pair:build([t,p('，我发现','wǒ fā xiàn'),pair[0],p('和','hé'),pair[1],p('一起吃很好吃。','yī qǐ chī hěn hǎo chī')],f'I found that {pair[0].en} and {pair[1].en} taste good together {t.en}.'))
G('Calling on arrival',product(PEOPLE,PLACES),lambda person,l:build([person,p('一到','yī dào'),l,p('，就给我打电话。','jiù gěi wǒ dǎ diàn huà')],f'{person.en} calls me as soon as they arrive at {l.en}.'))
G('Starting a good habit',product(PEOPLE,STUDY_GOALS),lambda person,pair:build([person,p('为了','wèi le'),pair[0],p('，已经开始','yǐ jīng kāi shǐ'),pair[1],p('了。','le')],f'To {pair[0].en}, {mid(person)} has started making time to {pair[1].en}.'))
G('Which is more interesting',[(a,b) for a,b in product(ACT,ACT) if a.zh!=b.zh],lambda a,b:build([p('你觉得','nǐ jué de'),a,p('比','bǐ'),b,p('更有意思吗？','gèng yǒu yì si ma')],f'Do you find {GERUND[a.zh]} more interesting than {GERUND[b.zh]}?'))
G('The same as mine',product(PEOPLE,NOUNS,ADJ),lambda person,n,a:build([person,p('的','de'),n,p('和我的一样','hé wǒ de yī yàng'),a,p('。','')],f"{person.en}'s {n.en} is as {a.en} as mine."))
G('Visiting again',product(PAST,PLACES),lambda d,l:build([p('我','wǒ'),d,p('又去了一次','yòu qù le yī cì'),l,p('，这次没有迷路。','zhè cì méi yǒu mí lù')],f'I went to {l.en} again {d.en}, and this time I did not get lost.'))
G('Rest before activity',product(PEOPLE,ACT,REST),lambda person,a,r:build([person,p('现在不想','xiàn zài bù xiǎng'),a,p('，想先','xiǎng xiān'),r,p('。','')],f"{person.en} doesn't feel like {GERUND[a.zh]} now and would like to {r.en} first."))
# Three HSK3 chunks keep each script small enough for simple hosting and review.
for level in [2,3]:
 group=[r for r in rows if r['level']==level]
 chunks=[group] if level==2 else [group[i:i+350] for i in range(0,len(group),350)]
 for i,chunk in enumerate(chunks):
  name=f'sentences-hsk{level}'+('' if level==2 else '-'+str(i))+'.js'
  (ROOT/'assets'/name).write_text('/* Original controlled sentence variants; generated by tools/build-sentence-bank.py. */\nREADING_SENTENCES.push(...'+json.dumps(chunk,ensure_ascii=False,separators=(',',':'))+');\n')
summary={'counts':{str(l):sum(r['level']==l for r in seed+rows) for l in [2,3]},'generated':len(rows),'families':len(stats),'unique':len(seen),'checks':['unique Chinese text','stable content-derived IDs','pinyin syllable / character alignment','nonempty English','slot compatibility by family'],'samples':[{'level':l,'topic':n,'zh':r[0],'py':r[1],'en':r[2]} for l,n,c,r in stats]}
(ROOT/'tools/sentence-bank-audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='samples'},ensure_ascii=False))
