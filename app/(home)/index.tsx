import { SignedIn, SignedOut, useUser, useClerk } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";

export default function HomePage() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    await clerk.signOut();
    router.push("/");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SignedIn>
        <View style={styles.contentContainer}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.emailText}>{user?.emailAddresses[0].emailAddress}</Text>
          
          <Link href="/browse" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Browse Cars</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href="/favorites" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>View Favorites</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href="/dealership" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Dealership Dashboard</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>My Profile</Text>
            </TouchableOpacity>
          </Link>
          
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SignedIn>
      <SignedOut>
        <View style={styles.contentContainer}>
          <Text style={styles.headerText}>Welcome to Car Dealership App</Text>
          <Text style={styles.subHeaderText}>Find your dream car or list your inventory</Text>
          <Link href="/sign-in" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/sign-up" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SignedOut>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: '80%',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emailText: {
    fontSize: 18,
    color: '#007AFF',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    width: '100%',
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});