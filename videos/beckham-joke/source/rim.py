import wave, numpy as np
SR=44100; N=SR*5; out=np.zeros(N); rng=np.random.default_rng(1)
def band(x,lo,hi):
    S=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); S*=(f>=lo)&(f<=hi); return np.fft.irfft(S,len(x))
def add(t,sig,g):
    i=int(t*SR); sig=sig[:N-i]; out[i:i+len(sig)]+=sig*g
def tom(t,f,g):
    n=int(.35*SR); tt=np.arange(n)/SR; add(t,np.sin(2*np.pi*np.cumsum(f*(1+.5*np.exp(-tt*25)))/SR)*np.exp(-tt*9),g)
def snare(t,g):
    n=int(.25*SR); tt=np.arange(n)/SR; add(t,(band(rng.standard_normal(n),1500,9000)+.5*np.sin(2*np.pi*200*tt))*np.exp(-tt*16),g)
def cym(t,g):
    n=int(1.2*SR); tt=np.arange(n)/SR; add(t,band(rng.standard_normal(n),5000,16000)*np.exp(-tt*3.5),g)
def crowd(t,d,g):
    n=int(d*SR); tt=np.arange(n)/SR
    c=sum(band(rng.standard_normal(n),300+250*k,900+400*k)*(.6+.4*np.sin(2*np.pi*(.3+.13*k)*tt+k)) for k in range(4))
    add(t,c*np.clip(tt/.3,0,1)*np.clip((d-tt)/.5,0,1),g)
crowd(0,5,.02)
tom(4.2,180,.5); tom(4.38,120,.5); snare(4.56,.35); cym(4.56,.3)
crowd(4.3,0.7,.05)
out*=np.clip((5-np.arange(N)/SR)/.25,0,1)
out=np.tanh(out*1.2); out*=.9/np.abs(out).max()
w=wave.open('rim.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
