import os

def patch_auth_context():
    file_path = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Ensure finally block exists to reset fetchInProgress.current
    if 'finally {' not in content:
        # This is a bit complex due to nested braces, but we can target the end of fetchProfile
        search_pattern = '    } catch (error: any) {'
        if search_pattern in content:
            # We found the catch block. We need to find the matching closing brace for the try/catch
            # Actually, let's just replace the whole fetchProfile method body for safety
            import re
            pattern = re.compile(r'const fetchProfile = useCallback\(async \(userId: string, email: string, isSilent: boolean = false\) => \{.*?\}, \[storeLogin, cachedUser\]\);', re.DOTALL)
            
            new_method = """const fetchProfile = useCallback(async (userId: string, email: string, isSilent: boolean = false) => {
    if (fetchInProgress.current) return;
    if (Date.now() - lastFetchTime.current < 2000) return;

    fetchInProgress.current = true;
    lastFetchTime.current = Date.now();

    if (!isSilent) {
      setState(prev => ({ ...prev, isLoading: true }));
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      if (profile) {
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          storeLogout();
          setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
          return;
        }

        const userData: User = {
          ...profile,
          email,
          role: profile.role as UserRole,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        };
        storeLogin(userData);
        setState({ user: userData, token: null, isAuthenticated: true, isLoading: false });
      }
    } catch (error: any) {
      console.error('[Auth] Profile fetch failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      clearTimeout(timeoutId);
      fetchInProgress.current = false;
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [storeLogin, cachedUser]);"""
            
            new_content = pattern.sub(new_method, content)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("Successfully patched AuthContext.tsx")

def patch_order_store():
    file_path = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\stores\useOrderStore.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove the "Skip duplicate" logic in subscribeOrders to restore real-time reliably
    bad_logic = """    if (existing && currentState !== 'errored' && currentState !== 'closed') {
      if (currentState === 'joining' || currentState === 'joined') {
        console.log(`♻️ Realtime: ${channelId} already ${currentState || 'initialized'}. Skipping duplicate.`)
        return () => { /* No-op cleanup for duplicate calls */ }
      }"""
      
    if bad_logic in content:
        # Instead of skipping, we always clean up and recreate to stay in sync with React lifecycle
        new_logic = """    if (existing) {
      console.log(`📡 Cleaning up existing channel ${channelId} before resubscribing...`)
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
    }"""
    
        content = content.replace(bad_logic, new_logic)
        
        # Also fix the following lines that were part of the old block
        content = content.replace("      // If it exists but is broken/closed, clean it up before recreating\n      supabase.removeChannel(existing)\n      activeChannels.delete(channelId)", "")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully patched useOrderStore.ts")

patch_auth_context()
patch_order_store()
