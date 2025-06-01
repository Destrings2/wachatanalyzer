import os
import re
from datetime import datetime, timedelta
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import matplotlib.font_manager as fm

from collections import Counter
from nltk.corpus import stopwords
import nltk
from wordcloud import WordCloud
from statsmodels.tsa.arima.model import ARIMA
from pmdarima import auto_arima
import emoji

warnings.filterwarnings("ignore")

# ---- Setup ----
nltk.download('stopwords', quiet=True)
plt.style.use('seaborn-v0_8')
sns.set_theme(style="whitegrid")

# Find a system emoji font
emoji_font_paths = [f for f in fm.findSystemFonts() if 'Emoji' in os.path.basename(f)]
if emoji_font_paths:
    emoji_font = emoji_font_paths[0]
    prop = fm.FontProperties(fname=emoji_font)
else:
    prop = None
    print("Warning: no color-emoji font found; emojis may not render correctly.")

# ---- Parsing ----
def parse_chat(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    pattern = r'\[(\d{2}/\d{2}/\d{4}, \d{2}:\d{2}:\d{2})\] (.+?): (.+)'
    matches = re.findall(pattern, content)
    msgs, calls = [], []
    for dt_str, sender, msg in matches:
        dt = datetime.strptime(dt_str, '%d/%m/%Y, %H:%M:%S')
        if 'Video call' in msg or 'Missed video call' in msg:
            duration = 0
            call_type = 'Missed' if 'Missed' in msg else 'Completed'
            if call_type == 'Completed':
                m = re.search(r'(\d+) (\w+)', msg)
                if m:
                    val, unit = int(m.group(1)), m.group(2)
                    duration = val * 60 if unit.startswith('hr') else val
            calls.append({'datetime': dt, 'initiator': sender, 'duration': duration, 'type': call_type})
        else:
            msgs.append({'datetime': dt, 'sender': sender, 'message': msg})
    return pd.DataFrame(msgs), pd.DataFrame(calls)

# ---- Emoji Analysis ----
def plot_emoji_usage(df):
    def extract_emojis(text):
        return ''.join(c for c in text if c in emoji.EMOJI_DATA)
    df['emojis'] = df['message'].apply(extract_emojis)
    all_emojis = ''.join(df['emojis'])
    counts = Counter(all_emojis)
    if not counts:
        print("No emojis found in the chat.")
        return
    top10 = dict(counts.most_common(10))
    # Attempt primary plotting with emoji font
    try:
        plt.figure(figsize=(12, 8))
        plt.barh(range(len(top10)), list(top10.values()), align='center')
        if prop:
            plt.yticks(range(len(top10)), list(top10.keys()), fontsize=20, fontproperties=prop)
        else:
            plt.yticks(range(len(top10)), list(top10.keys()), fontsize=20)
        for i, v in enumerate(top10.values()):
            plt.text(v, i, f' {v}', va='center')
        plt.gca().invert_yaxis()
        plt.title('Top 10 Most Used Emojis', fontsize=16, fontweight='bold')
        plt.xlabel('Count', fontsize=12)
        plt.tight_layout()
        plt.savefig('top_emojis.png', dpi=300, bbox_inches='tight')
        plt.close()
        print("Emoji usage analysis complete.")
    except Exception as e:
        print(f"Emoji plot failed: {e}. Falling back to basic plot.")
        plt.figure(figsize=(12, 8))
        plt.barh(range(len(top10)), list(top10.values()), align='center')
        plt.yticks(range(len(top10)), list(top10.keys()), fontsize=12)
        for i, v in enumerate(top10.values()):
            plt.text(v, i, f' {v}', va='center')
        plt.gca().invert_yaxis()
        plt.title('Top 10 Most Used Emojis', fontsize=16, fontweight='bold')
        plt.xlabel('Count', fontsize=12)
        plt.savefig('top_emojis.png', dpi=300, bbox_inches='tight')
        plt.close()
        print("Emoji usage analysis complete (fallback plot).")

# ---- Message Lengths ----
def analyze_message_lengths_by_sender(df):
    df['length'] = df['message'].astype(str).str.len()
    valid = df[['sender', 'length']].dropna()
    senders = valid['sender'].unique()
    fig, axes = plt.subplots(len(senders), 1, figsize=(12, 6*len(senders)), sharex=True)
    if len(senders) == 1:
        axes = [axes]
    fig.suptitle('Distribution of Message Lengths by Sender', fontsize=16, fontweight='bold')
    for ax, sender in zip(axes, senders):
        data = valid[valid['sender'] == sender]['length']
        sns.histplot(data, bins=50, kde=True, ax=ax)
        mean, med = data.mean(), data.median()
        ax.axvline(mean, color='r', linestyle='--', label=f'Mean: {mean:.1f}')
        ax.axvline(med, color='g', linestyle='--', label=f'Median: {med:.1f}')
        ax.set_title(sender, fontsize=14)
        ax.set_ylabel('Frequency', fontsize=12)
        ax.legend()
        print(f"{sender} – mean: {mean:.2f}, median: {med:.2f}")
    plt.xlabel('Message Length (chars)', fontsize=12)
    plt.tight_layout()
    plt.savefig('message_length_distribution.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Message length analysis by sender complete.")

# ---- Main Pipeline ----
def analyze_chat(file_path):
    msgs_df, calls_df = parse_chat(file_path)
    # 1: counts by sender
    msg_count = msgs_df['sender'].value_counts()
    img_count = msgs_df[msgs_df['message'].str.contains('image omitted', case=False, na=False)]['sender'].value_counts()
    stk_count = msgs_df[msgs_df['message'].str.contains('sticker omitted', case=False, na=False)]['sender'].value_counts()
    plt.figure(figsize=(15, 8))
    x = range(len(msg_count)); w=0.25
    plt.bar(x, msg_count, w, label='Messages')
    plt.bar([i+w for i in x], img_count, w, label='Images')
    plt.bar([i+2*w for i in x], stk_count, w, label='Stickers')
    plt.xticks([i+w for i in x], msg_count.index, rotation=45, ha='right')
    plt.xlabel('Sender'); plt.ylabel('Count'); plt.title('Counts by Sender')
    plt.legend(); plt.tight_layout(); plt.savefig('counts_by_sender.png', dpi=300, bbox_inches='tight'); plt.close()
    # 2: time series + ARIMA
    msgs_df['date']=msgs_df['datetime'].dt.date
    daily=msgs_df.groupby('date').size().rename('count').to_frame()
    daily['trend']=daily['count'].rolling(7, center=True).mean()
    model=auto_arima(daily['count'], seasonal=False, stepwise=True, suppress_warnings=True)
    arima=ARIMA(daily['count'], order=model.order).fit(); fcast=arima.forecast(30)
    idx=pd.date_range(start=daily.index[-1]+timedelta(days=1), periods=30)
    plt.figure(figsize=(16,8)); plt.plot(daily.index,daily['count'],alpha=0.5,linewidth=2,label='Daily')
    plt.plot(daily.index,daily['trend'],color='red',linewidth=3,label='7d MA')
    plt.plot(idx,fcast,color='green',linewidth=3,label='ARIMA Forecast'); plt.fill_between(daily.index,daily['count'],alpha=0.3)
    plt.xlabel('Date'); plt.ylabel('Messages'); plt.title(f"Activity & Forecast ARIMA{model.order}"); plt.legend(); plt.grid(linestyle='--',alpha=0.7)
    plt.tight_layout(); plt.savefig('daily_forecast.png', dpi=300, bbox_inches='tight'); plt.close()
    # 3: call heatmap
    if not calls_df.empty:
        calls_df['dow']=calls_df['datetime'].dt.dayofweek; calls_df['hour']=calls_df['datetime'].dt.hour
        heat=calls_df.groupby(['dow','hour'])['duration'].mean().unstack()
        plt.figure(figsize=(14,8)); sns.heatmap(heat,cmap='YlOrRd',annot=True,fmt='.1f')
        plt.xlabel('Hour'); plt.ylabel('Day of Week'); plt.yticks(range(7),['Mon','Tue','Wed','Thu','Fri','Sat','Sun']); plt.title('Video Call Duration Heatmap')
        plt.tight_layout(); plt.savefig('call_heatmap.png', dpi=300, bbox_inches='tight'); plt.close()
    # 4: stats
    total=len(calls_df); comp=calls_df[calls_df['type']=='Completed']; miss=calls_df[calls_df['type']=='Missed']
    avg_dur=comp['duration'].mean() if not comp.empty else 0
    print(f"Total calls: {total}, Completed: {len(comp)}, Missed: {len(miss)}, Avg duration: {avg_dur:.2f} min")
    # 5: word cloud
    spanish_sw=set(stopwords.words('spanish'))
    corpus=' '.join(msgs_df['message'].str.lower().str.split().apply(lambda ws: ' '.join(w for w in ws if w.isalpha() and w not in spanish_sw)))
    wc=WordCloud(width=1600,height=800,background_color='white',colormap='viridis',max_font_size=200).generate(corpus)
    plt.figure(figsize=(20,10)); plt.imshow(wc,interpolation='bilinear'); plt.axis('off'); plt.title('Word Cloud',fontsize=24,pad=20)
    plt.tight_layout(); plt.savefig('wordcloud.png', dpi=300, bbox_inches='tight'); plt.close()
    analyze_message_lengths_by_sender(msgs_df)
    # 7: active hours
    msgs_df['hour']=msgs_df['datetime'].dt.hour; hours=msgs_df['hour'].value_counts().sort_index()
    plt.figure(figsize=(12,6)); sns.barplot(x=hours.index,y=hours.values); plt.xlabel('Hour'); plt.ylabel('Messages'); plt.title('Activity by Hour')
    plt.tight_layout(); plt.savefig('active_hours.png', dpi=300, bbox_inches='tight'); plt.close()
    plot_emoji_usage(msgs_df)
    # 9: response times
    msgs_df['resp_min']=msgs_df.groupby('sender')['datetime'].diff().dt.total_seconds()/60
    resp=msgs_df.groupby('sender')['resp_min'].mean().dropna()
    if not resp.empty:
        plt.figure(figsize=(10,6)); sns.barplot(x=resp.index,y=resp.values); plt.xlabel('Sender'); plt.ylabel('Avg Response (min)')
        plt.title('Average Response Time'); plt.xticks(rotation=45,ha='right'); plt.tight_layout(); plt.savefig('response_time.png', dpi=300, bbox_inches='tight'); plt.close()
    else:
        print("Not enough data for response times.")

if __name__ == '__main__':
    analyze_chat('../../../../Downloads/msgs.txt')
